#!/usr/bin/env node
/**
 * Plano determinístico do split híbrido de países (excluindo China '156'):
 * - Exatamente 100 países locais no repositório (`public/countries/<id>/`):
 *   os 11 destaques já gerados + os 89 maiores países habitados por área.
 * - Demais países habitados vão para staging externo (`outputs/supabase-countries/countries/<id>/`)
 *   para upload no Supabase Storage (`bucket: nasa-countries`).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_DIR = path.resolve(__dirname, '..');
export const LOCAL_COUNTRIES_LIMIT = 100;
export const EXCLUDED_COUNTRY_IDS = new Set(['156']);

export const PRIORITY_LOCAL_IDS = [
  '076', // Brasil
  '840', // EUA
  '250', // França
  '392', // Japão
  '276', // Alemanha
  '818', // Egito
  '356', // Índia
  '484', // México
  '036', // Austrália
  '710', // África do Sul
  '620', // Portugal
];

export async function loadCountrySplitPlan() {
  const tmpDir = path.join(os.tmpdir(), 'earth-jukebox-gen');
  fs.mkdirSync(tmpDir, { recursive: true });
  const countriesBundlePath = path.join(tmpDir, 'countries.split.bundle.mjs');
  await build({
    entryPoints: [path.join(WORKSPACE_DIR, 'src/geo/countries.ts')],
    outfile: countriesBundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });

  const { loadWorldCountries } = await import(pathToFileURL(countriesBundlePath).href);
  const world = loadWorldCountries();

  const eligible = world.countries.filter(
    (c) => !c.isMinorUninhabited && !EXCLUDED_COUNTRY_IDS.has(c.id)
  );
  const byId = new Map(eligible.map((c) => [c.id, c]));

  const localCountries = [];
  const used = new Set();

  for (const id of PRIORITY_LOCAL_IDS) {
    const c = byId.get(id);
    if (c && !used.has(c.id)) {
      localCountries.push(c);
      used.add(c.id);
    }
  }

  const remainingByArea = eligible
    .filter((c) => !used.has(c.id))
    .sort((a, b) => {
      if (b.areaApproxKm2 !== a.areaApproxKm2) return b.areaApproxKm2 - a.areaApproxKm2;
      return a.id.localeCompare(b.id);
    });

  for (const c of remainingByArea) {
    if (localCountries.length >= LOCAL_COUNTRIES_LIMIT) break;
    localCountries.push(c);
    used.add(c.id);
  }

  const remoteCountries = eligible
    .filter((c) => !used.has(c.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    totalEligible: eligible.length,
    excludedIds: Array.from(EXCLUDED_COUNTRY_IDS),
    localCountries,
    remoteCountries,
    localIds: localCountries.map((c) => c.id),
    remoteIds: remoteCountries.map((c) => c.id),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = await loadCountrySplitPlan();
  const outJsonPath = path.join(WORKSPACE_DIR, 'outputs', 'country_split_plan.json');
  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(
    outJsonPath,
    JSON.stringify(
      {
        totalEligible: plan.totalEligible,
        excludedIds: plan.excludedIds,
        localCount: plan.localIds.length,
        remoteCount: plan.remoteIds.length,
        localIds: plan.localIds,
        remoteIds: plan.remoteIds,
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify({
      totalEligible: plan.totalEligible,
      excludedIds: plan.excludedIds,
      localCount: plan.localIds.length,
      remoteCount: plan.remoteIds.length,
      planFile: outJsonPath,
    })
  );
}
