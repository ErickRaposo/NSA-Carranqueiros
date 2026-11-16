# MINEIRØ · Earth Jukebox (NASA SVS Planetarium & Geo-Sonification)

An immersive corner-projected planetary installation (**Left Wall + Right Wall + Ceiling**), **Tablet Remote Controller**, and **Unified Web Demo** that turns real **NASA Scientific Visualization Studio (SVS)** atmospheric datasets into synchronized spatial music (8D Binaural HRTF & 3-speaker VBAP room audio) and layered visual art—designed from the ground up with **WCAG AAA accessibility** and **PT-BR / EN** support.

## Scientific Datasets (NASA SVS)

- **SVS 5011 (`melody`)** — *Lightning Events Detected from the ISS (2017–2023)* (`4096×2048` Science on a Sphere) → Celesta/Rhodes melody + crystalline storm sparkles
- **SVS 5147 (`temperature`)** — *GEOS-FP Near-Surface Temperature* (`2048×1024`) → Tempo & musical key tuning conductor (`Region` 66–110 BPM vs neutral `Base` 90 BPM / A)
- **SVS 5148 (`wind`)** — *GEOS-FP Near-Surface Wind Speed* (`2048×1024`) → Spatial audio bus (chorus, ping-pong delay, filter & reverb modulated by wind speed/orientation)
- **SVS 5153 (`chords`)** — *Carbon Monoxide (CO) — GEOS-CF* (`2048×1024`) → Harmonic mode & chord pad progression (Lydian → Phrygian)
- **SVS 5154 (`bass`)** — *Nitrogen Oxides (NOx) — GEOS-CF* (`2048×1024`) → Sub-bass fundamental & harmonic drive

---

## Application Routes & Experience Modes (`?view=`)

- **`?view=portal` (Default `/`):** Project introduction, 3D Mineirø guide, team credits, and fullscreen presentation video.
- **`?view=setup`:** Guided installation wizard—room creation (`?room=XXXXXX`), language selection, physical corner dimensions, projector corner-pin calibration, QR code controller pairing, and 3-speaker delay/pink-noise acoustic calibration.
- **`?view=demo` (also `/demo`, `/sala`, and `?view=simulator` redirect):** Unified 50/50 split screen combining the 3D/2D corner room simulation with the interactive Tablet Controller for single-screen evaluation and public deployment.
- **`?view=controller` (also `/controller`, `/controle`):** Visitor Tablet UI (3D globe country picker + Photoshop-style 5-layer mixer + voice narration controls).
- **`?view=projector&out=1|2|3`:** Pure `#000000` fullscreen projector surface outputs with 4-point corner-pin homography.
- **`?view=admin` (also `/admin`):** Show Control / Technical Panel for matrix patching, room diagnostics, and acoustic tuning.
- **`?view=audio-node&spk=1|2|3`:** Dedicated browser audio node per physical speaker in multi-device LAN setups.

---

## Hybrid Country Architecture (100 Local + 142 Supabase Storage)

To deliver real pre-rendered visuals and gapless multi-stem audio across **242 inhabited countries and territories** (excluding China `'156'`, filtered in [`src/geo/countries.ts`](src/geo/countries.ts) and all generation scripts) while respecting **GitHub Pages (1 GB site limit)** and **Supabase Free Tier Storage (1 GB limit)**, assets are split cleanly into two tiers:

| Tier | Countries | Storage Location | Measured Size | Purpose |
| :--- | :---: | :--- | :---: | :--- |
| **Local Bundle** | **100** | `public/countries/<id>/` *(in Git)* | **468 MB** *(682 MB full `dist/`)* | 11 featured destinations + 89 largest countries by area; works offline & out of the box |
| **Remote Bucket** | **142** | `outputs/supabase-countries/countries/<id>/` *(gitignored)* → Supabase bucket `nasa-countries` | **445.1 MB** *(3,834 files)* | Remaining countries & islands loaded on demand from Supabase Storage |

### Files Inside Each Country Package (`<id>/`)
- **5 Layer Silhouettes (`1024×1024` RGBA PNG):** `melody.png`, `chords.png`, `temperature.png`, `bass.png`, `wind.png`
- **5 NASA Sprite Sheets (`12×8` = 96 frames, JPEG `q=76`):** `video/<layer>_sheet.jpg`
- **16 Gapless Audio Stems (Ogg Vorbis `-q 2`):**
  - `region/{chords,bass,melody_main,melody_sparkle}_{dry,wind}.ogg`
  - `base/{chords,bass,melody_main,melody_sparkle}_{dry,wind}.ogg`
- **Metadata & MIDI Score:** `meta.json` (minified JSON with bounding box, NASA telemetry summary, tempo/chords, and 96-frame studio MIDI tracks)

### How Runtime Asset Resolution Works
1. On startup, [`ExperienceContext.tsx`](src/experience/ExperienceContext.tsx) fetches `/countries/index.json` containing `generatedIds` (100 local) and `remoteIds` (142 remote).
2. [`resolveRemoteCountriesBaseUrl()`](src/datasets/nasaDatasets.ts) determines the remote base URL using (in order): `index.json` `remoteBaseUrl` → `VITE_REMOTE_COUNTRIES_BASE_URL` → `VITE_SUPABASE_COUNTRIES_BASE_URL` → auto-derived `${VITE_SUPABASE_URL}/storage/v1/object/public/nasa-countries`.
3. **Fallback & Safety Behavior:**
   - **Local Dev (`npm run dev` / `npm run preview`):** [`vite.config.ts`](vite.config.ts) checks if `outputs/supabase-countries/countries/` exists on disk; if found, it injects `localStagingAvailable: true` into `/countries/index.json` and streams remote countries locally even before Supabase credentials are configured.
   - **Production without Supabase Storage configured:** Only the **100 local countries** are exposed in the UI (zero 404 errors).
   - **Production with Supabase configured:** All **242 countries** appear automatically, and external assets load with `crossOrigin="anonymous"` so WebGL/Canvas pipelines remain untainted.

---

## How to Run on Any Machine

### Prerequisites
- **Required for running the web app:** [Node.js](https://nodejs.org/) `>= 18` and `npm`.
- **Optional (only if you want to generate the 142 remote country packages locally or regenerate assets):**
  - **Python 3** (`>= 3.10`) with `numpy`, `scipy`, and `opencv-python-headless`
  - **Vorbis encoder & video tools:** [`vorbis-tools`](https://xiph.org/vorbis/) (`oggenc`) and/or `ffmpeg`
  - **macOS fast PNG renderer (automatic):** Xcode Command Line Tools (`swiftc`, pre-installed or via `xcode-select --install`). *Windows and Linux automatically fall back to Python (`scripts/render_country_layers.py`).*

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/ErickRaposo/NSA-Mineiro.git
cd NSA-Mineiro
npm install
```

### 2. Quick Start (100 Countries, Zero Configuration)

You do **not** need Supabase or Python just to run and develop the app—100 countries and all LAN features work immediately:

```bash
npm run dev
```

Open `http://localhost:5173/` in your browser (add `-- --host` or open your machine's LAN IP shown in `?view=setup` to connect a physical tablet/phone on the same Wi-Fi).

---

### 3. Setting Up Supabase (Cloud Rooms + All 242 Countries)

Follow these steps to enable online `?room=XXXXXX` synchronization across networks and serve the 142 extra countries from Supabase Storage:

1. **Create a free Supabase project** at [supabase.com](https://supabase.com/).
2. **Create the `rooms` table:** Open the **SQL Editor** in your Supabase dashboard, paste the contents of [`supabase/rooms.sql`](supabase/rooms.sql), and run it.
3. **Create `.env.local`:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your project credentials in `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   VITE_SUPABASE_COUNTRIES_BUCKET=nasa-countries

   # Only needed locally to run scripts/upload_countries_to_supabase.mjs (NEVER prefix with VITE_)
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret>
   ```
4. **Generate the 142 remote country packages locally** (since `outputs/` is gitignored; see Section 4 below) **and upload them to Supabase Storage:**
   ```bash
   # Preview file count & total MB before uploading
   node scripts/upload_countries_to_supabase.mjs --dry-run

   # Creates the public "nasa-countries" bucket if missing and uploads all 3,834 files
   node scripts/upload_countries_to_supabase.mjs
   ```
   *(The upload script also records `remoteBaseUrl` in [`public/countries/index.json`](public/countries/index.json) or you can rely on `VITE_SUPABASE_URL` at runtime/Vercel/GitHub Pages env vars.)*

---

### 4. Regenerating Countries or Generating the 142 Remote Tier Locally

The batch pipeline uses the 5 raw NASA videos already present in [`public/nasa/`](public/nasa).

#### A. Install Media Tools & Python Environment

**macOS (Homebrew):**
```bash
brew install ffmpeg vorbis-tools
python3 -m venv .venv-gen
.venv-gen/bin/pip install numpy scipy opencv-python-headless
```

**Ubuntu / Debian Linux:**
```bash
sudo apt update && sudo apt install -y ffmpeg vorbis-tools python3-venv
python3 -m venv .venv-gen
.venv-gen/bin/pip install numpy scipy opencv-python-headless
```

**Windows (PowerShell):**
```powershell
winget install Gyan.FFmpeg
python -m venv .venv-gen
.\.venv-gen\Scripts\pip install numpy scipy opencv-python-headless
```

#### B. Inspect Split & Generate PNGs + Sprite Sheets + OGG Stems + MIDI

```bash
# 1. Inspect the deterministic 100 local / 142 remote split plan (writes outputs/country_split_plan.json)
node scripts/country_split.mjs

# 2. Generate 5 RGBA PNGs + base meta.json for the 142 remote countries into outputs/supabase-countries/countries/
node scripts/generate_country_layers.mjs --remote-rest --skip-existing

# (Optional) Regenerate any missing local countries in public/countries/:
node scripts/generate_country_layers.mjs --local-100 --skip-existing

# 3. Synthesize 16 gapless OGG stems + 5 96-frame sprite sheets + MIDI scores for both tiers
# Use ./.venv-gen/Scripts/python on Windows
.venv-gen/bin/python scripts/generate_country_audio.py --split-hybrid --workers=4
```

This updates [`public/countries/index.json`](public/countries/index.json) (`generatedIds`, `remoteIds`, `localCount`, `remoteCount`, `totalCount`, `excludedIds: ["156"]`).

---

### 5. Running Tests & Production Builds

```bash
npm test       # Runs the full Vitest suite (11 files / 74 tests, validates local assets & routing)
npm run build  # Type-checks (tsc -b) and creates dist/ (~682 MB, ready for Vercel or GitHub Pages)
npm run preview
```

> **GitHub Pages sub-path note:** If deploying under a repository subpath (for example `/NSA-Mineiro/`), set `VITE_BASE_PATH=/NSA-Mineiro/` before running `npm run build`. Keep `VITE_BASE_PATH` empty for root domains (Vercel, custom domain, or local preview).

---

## Technical Documentation

- [`docs/DIARIO_TECNICO_E_TESTES.md`](docs/DIARIO_TECNICO_E_TESTES.md) — Architecture log, engineering decisions, fixes, and test history.
- [`docs/LINGUAGENS_E_TECNOLOGIAS.md`](docs/LINGUAGENS_E_TECNOLOGIAS.md) — Languages, WebGL/GLSL shaders, Web Audio / Web Speech APIs, and dependencies.
- [`docs/REFERENCIAS_E_LICENCAS.md`](docs/REFERENCIAS_E_LICENCAS.md) — NASA SVS scientific citations, `flag-icons` (MIT), offline cartography, and credits.
- [`docs/VOZES_PIPER_TTS.md`](docs/VOZES_PIPER_TTS.md) — Offline neural voice TTS (`@mintplex-labs/piper-tts-web`) setup and fallback behavior.
