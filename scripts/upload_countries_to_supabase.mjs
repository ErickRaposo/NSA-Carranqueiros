#!/usr/bin/env node
/**
 * Upload overflow countries (beyond the 100 local ones in the repo) to Supabase Storage.
 *
 * Prerequisites in `.env.local` (or environment variables):
 *   VITE_SUPABASE_URL=https://<your-project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_secret>   (NEVER with VITE_ prefix)
 *   VITE_SUPABASE_COUNTRIES_BUCKET=nasa-countries     (optional, default: nasa-countries)
 *
 * Usage:
 *   node scripts/upload_countries_to_supabase.mjs
 *   node scripts/upload_countries_to_supabase.mjs --dry-run
 *   node scripts/upload_countries_to_supabase.mjs --ids=246,752
 *   node scripts/upload_countries_to_supabase.mjs --concurrency=6
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = path.resolve(__dirname, '..');
const STAGING_DIR = path.join(WORKSPACE_DIR, 'outputs/supabase-countries/countries');
const INDEX_PATH = path.join(WORKSPACE_DIR, 'public/countries/index.json');

function loadEnvFiles() {
  for (const name of ['.env', '.env.local']) {
    const p = path.join(WORKSPACE_DIR, name);
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function getContentType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.ogg')) return 'audio/ogg';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function walkFiles(dirPath) {
  const out = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

loadEnvFiles();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const idsArg = args.find((a) => a.startsWith('--ids='));
const concArg = args.find((a) => a.startsWith('--concurrency='));
const concurrency = Math.max(1, Math.min(12, Number(concArg?.slice('--concurrency='.length) || 6)));
const filterIds = idsArg
  ? new Set(idsArg.slice('--ids='.length).split(',').map((s) => s.trim()).filter(Boolean))
  : null;

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const bucket = (process.env.VITE_SUPABASE_COUNTRIES_BUCKET || 'nasa-countries').trim() || 'nasa-countries';

if (!fs.existsSync(STAGING_DIR)) {
  console.error(`❌ Pasta de staging não encontrada: ${STAGING_DIR}`);
  console.error('Rode primeiro o gerador híbrido para gerar os países excedentes.');
  process.exit(1);
}

const countryDirs = fs
  .readdirSync(STAGING_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== '156' && (!filterIds || filterIds.has(d.name)))
  .map((d) => d.name)
  .sort();

const items = [];
let totalBytes = 0;
for (const cid of countryDirs) {
  const fullDir = path.join(STAGING_DIR, cid);
  for (const file of walkFiles(fullDir)) {
    const relFromStaging = path.relative(STAGING_DIR, file).split(path.sep).join('/');
    const objectPath = `countries/${relFromStaging}`;
    const size = fs.statSync(file).size;
    totalBytes += size;
    items.push({ file, objectPath, contentType: getContentType(file), size });
  }
}

console.log(
  `📦 Países em staging: ${countryDirs.length} | Arquivos: ${items.length} | Tamanho total: ${(
    totalBytes /
    (1024 * 1024)
  ).toFixed(1)} MB`
);
console.log(`🪣 Destino: bucket público "${bucket}" (${supabaseUrl || 'VITE_SUPABASE_URL não definido'})`);

if (dryRun) {
  console.log('✅ Dry-run concluído (nenhum arquivo enviado).');
  process.exit(0);
}

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local para fazer o upload.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Ensure public bucket exists
const { data: existingBucket } = await supabase.storage.getBucket(bucket);
if (!existingBucket) {
  const { error: createErr } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024,
  });
  if (createErr) {
    console.error(`❌ Erro criando bucket "${bucket}":`, createErr.message);
    process.exit(1);
  }
  console.log(`🪣 Bucket público "${bucket}" criado com sucesso.`);
} else if (!existingBucket.public) {
  await supabase.storage.updateBucket(bucket, { public: true });
}

let uploaded = 0;
let failed = 0;
let cursor = 0;

async function worker() {
  while (cursor < items.length) {
    const idx = cursor++;
    const item = items[idx];
    const buf = fs.readFileSync(item.file);
    const { error } = await supabase.storage.from(bucket).upload(item.objectPath, buf, {
      contentType: item.contentType,
      cacheControl: '31536000',
      upsert: force || true,
    });
    if (error) {
      failed++;
      console.error(`❌ [${idx + 1}/${items.length}] ${item.objectPath}: ${error.message}`);
    } else {
      uploaded++;
      if (uploaded % 100 === 0 || uploaded === items.length) {
        console.log(`⬆️  Progresso: ${uploaded}/${items.length} arquivos enviados...`);
      }
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}`;
if (fs.existsSync(INDEX_PATH)) {
  const idxJson = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  idxJson.remoteBaseUrl = publicBaseUrl;
  idxJson.remoteBucket = bucket;
  fs.writeFileSync(INDEX_PATH, JSON.stringify(idxJson));
  console.log(`📝 public/countries/index.json atualizado com remoteBaseUrl = ${publicBaseUrl}`);
}

console.log(`✅ Upload finalizado: ${uploaded} enviados, ${failed} falhas.`);
if (failed > 0) process.exit(1);
