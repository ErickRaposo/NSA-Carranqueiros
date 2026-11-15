#!/usr/bin/env node
/**
 * Pipeline de Pré-Geração dos 5 PNGs (1024x1024 RGBA) + meta.json por país.
 *
 * Uso:
 *   node scripts/generate_country_layers.mjs            # Gera os 3 Países Piloto: Brasil (076), Egito (818), China (156)
 *   node scripts/generate_country_layers.mjs --ids=076,818,156,840,484
 *   node scripts/generate_country_layers.mjs --all      # Gera todos os ~177 países habitados do mundo!
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(__dirname, '..');
const tmpDir = path.join(os.tmpdir(), 'earth-jukebox-gen');
fs.mkdirSync(tmpDir, { recursive: true });

// 1. Bundle src/geo/countries.ts on the fly so IDs & polygons match the frontend 100%
const countriesBundlePath = path.join(tmpDir, 'countries.bundle.mjs');
await build({
  entryPoints: [path.join(workspaceDir, 'src/geo/countries.ts')],
  outfile: countriesBundlePath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

const { loadWorldCountries } = await import(pathToFileURL(countriesBundlePath).href);
const world = loadWorldCountries();

// 2. Determine target country IDs
const args = process.argv.slice(2);
const runAll = args.includes('--all');
const idsArg = args.find((a) => a.startsWith('--ids='));
const requestedIds = idsArg
  ? idsArg
      .slice('--ids='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : ['076', '818', '156']; // Default: 3 Pilot Countries requested by Shay (Brasil, Egito, China)

function computePrimaryFramingBbox(country) {
  // Compute polygon areas & bboxes so significant islands/archipelagos (Fernando de Noronha, Hainan, Japan, Indonesia)
  // are framed cleanly, while microscopic mid-ocean rocks > 6° away (< 0.15% area) don't shrink mainland silhouettes.
  const polyStats = country.polygons.map((poly) => {
    const outer = poly[0] || [];
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    const refLon = outer[0]?.[0] ?? country.lon;
    let area2 = 0;
    const pts = outer.map(([lon, lat]) => {
      let adjLon = lon;
      if (adjLon - refLon > 180) adjLon -= 360;
      else if (refLon - adjLon > 180) adjLon += 360;
      if (adjLon < minLon) minLon = adjLon;
      if (adjLon > maxLon) maxLon = adjLon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return [adjLon, lat];
    });
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      area2 += x0 * y1 - x1 * y0;
    }
    return {
      poly,
      ptsPolygons: poly.map((ring) =>
        ring.map(([lon, lat]) => {
          let adjLon = lon;
          if (adjLon - country.lon > 180) adjLon -= 360;
          else if (country.lon - adjLon > 180) adjLon += 360;
          return [adjLon, lat];
        })
      ),
      area: Math.abs(area2) * 0.5,
      minLon,
      maxLon,
      minLat,
      maxLat,
    };
  });

  polyStats.sort((a, b) => b.area - a.area);
  const main = polyStats[0];
  let envMinLon = main.minLon;
  let envMaxLon = main.maxLon;
  let envMinLat = main.minLat;
  let envMaxLat = main.maxLat;

  for (let i = 1; i < polyStats.length; i++) {
    const p = polyStats[i];
    const relArea = p.area / Math.max(1e-9, main.area);
    // Measure gap relative to MAINLAND (main) rather than chained stepping-stone rocks
    const lonGap = Math.max(0, main.minLon - p.maxLon, p.minLon - main.maxLon);
    const latGap = Math.max(0, main.minLat - p.maxLat, p.minLat - main.maxLat);
    // Keep any island >= 0.4% of mainland OR within 4.2° of mainland (keeps Fernando de Noronha, Hainan, Tasmania, etc.)
    if (relArea >= 0.004 || (lonGap <= 4.2 && latGap <= 4.2)) {
      if (p.minLon < envMinLon) envMinLon = p.minLon;
      if (p.maxLon > envMaxLon) envMaxLon = p.maxLon;
      if (p.minLat < envMinLat) envMinLat = p.minLat;
      if (p.maxLat > envMaxLat) envMaxLat = p.maxLat;
    }
  }

  return {
    bbox: [
      Number(envMinLon.toFixed(4)),
      Number(envMinLat.toFixed(4)),
      Number(envMaxLon.toFixed(4)),
      Number(envMaxLat.toFixed(4)),
    ],
    normalizedPolygons: polyStats.map((p) => p.ptsPolygons),
  };
}

const selectedCountries = world.countries.filter((c) =>
  runAll ? !c.isMinorUninhabited : requestedIds.includes(c.id)
);

if (selectedCountries.length === 0) {
  console.error('Nenhum país encontrado para os IDs informados:', requestedIds);
  process.exit(1);
}

const manifestPath = path.join(tmpDir, 'manifest.json');
const cacheDir = path.join(tmpDir, 'nasa_equirect_cache');
const outBaseDir = path.join(workspaceDir, 'public/countries');

const manifest = {
  workspaceDir,
  cacheDir,
  outBaseDir,
  countries: selectedCountries.map((c) => {
    const { bbox, normalizedPolygons } = computePrimaryFramingBbox(c);
    return {
      id: c.id,
      nameEn: c.nameEn,
      namePt: c.namePt,
      lon: c.lon,
      lat: c.lat,
      bbox,
      polygons: normalizedPolygons,
    };
  }),
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest));

// 3. Use Swift CoreGraphics on macOS when available, or cross-platform Python (OpenCV + SciPy) on Windows/Linux
const swiftSrc = path.join(__dirname, 'render_country_layers.swift');
const pySrc = path.join(__dirname, 'render_country_layers.py');
const swiftBin = path.join(tmpDir, 'render_country_layers_bin');

let canUseSwift = false;
if (process.platform === 'darwin') {
  try {
    execFileSync('swiftc', ['--version'], { stdio: 'ignore' });
    canUseSwift = true;
  } catch {
    canUseSwift = false;
  }
}

if (canUseSwift) {
  const needCompile =
    !fs.existsSync(swiftBin) ||
    fs.statSync(swiftSrc).mtimeMs > fs.statSync(swiftBin).mtimeMs;
  if (needCompile) {
    console.log('⚙️  Compilando renderizador Swift CoreGraphics (-O)...');
    execFileSync('swiftc', ['-O', swiftSrc, '-o', swiftBin], { stdio: 'inherit' });
  }
  console.log(`🌍 Gerando camadas PNG 1024x1024 + meta.json para ${selectedCountries.length} país(es) [Swift]...`);
  execFileSync(swiftBin, [manifestPath], { stdio: 'inherit' });
} else {
  const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
  console.log(`🌍 Gerando camadas PNG 1024x1024 + meta.json para ${selectedCountries.length} país(es) [Python]...`);
  execFileSync(pyCmd, [pySrc, manifestPath], { stdio: 'inherit' });
}
console.log(`✅ Concluído! Arquivos salvos em ${outBaseDir}`);
