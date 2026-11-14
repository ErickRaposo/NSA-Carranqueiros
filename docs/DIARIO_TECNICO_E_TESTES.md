# Diário Técnico, Caminhos Avaliados, Testes e Resultados — NASA SVS Earth Video Explorer

Este documento registra todo o processo de engenharia, investigação das fontes da NASA, caminhos arquiteturais avaliados, decisões técnicas, problemas encontrados durante os testes e resultados objetivos obtidos.

---

## 1. Investigação Inicial das Fontes da NASA SVS

Antes de escolher o motor de renderização, inspecionamos os arquivos publicados nas duas páginas oficiais fornecidas:

### 1.1 SVS 5011 — *Lightning Events Detected from the ISS (2017–2023)*
- Página: `https://svs.gsfc.nasa.gov/5011/`
- Arquivos encontrados na página:
  - `iss_lightning_sphere_07312023.mp4` (`1920×1080`, 127 MB) — vídeo de globo já pré-renderizado girando em tela 16:9 (não permite navegar livremente para qualquer país).
  - `iss_lightning_sphere_07312023_60p4k.mp4` (`3840×2160`, 414,2 MB) — versão 4K do globo pré-renderizado.
  - `iss_lightning_eic_display_2160p30_h2652.mp4` (`7680×2160`, 579,9 MB, H.265) — layout panorâmico para painel EIC.
  - **Descoberta decisiva (Seção Science on a Sphere / SOS):** `iss_lightning_sos_yearly_07312023_2048p60.mp4` (`350.207.237` bytes ≈ 334 MiB).
    - Resolução verificada localmente com `mdls` e `<video>`: **`4096×2048`** (proporção exata **2:1 equiretangular global**), duração **`100.033333 s`**, codec **`avc1` (H.264)**.

### 1.2 SVS 5148 — *GEOS-FP Near-Surface Wind Speed*
- Página: `https://svs.gsfc.nasa.gov/5148/`
- Arquivos baixados e verificados:
  - `MC02_stage3_GMAO_near_surface_wind_2048x1024_en.mp4` (`68.618.794` bytes ≈ 65 MiB).
    - Resolução verificada: **`2048×1024`** (proporção exata **2:1 equiretangular global**), duração **`31 s`**, codec **`avc1` (H.264)**.
  - `NearSurfaceWindSpeed_colorbar.png` (`528×165`, 14 KB) e `NearSurfaceWindSpeed_colorbar_plain.png` (`528×165`, 7,7 KB).

### 1.3 SVS 5147 — *GEOS-FP Near-Surface Temperature*
- Página: `https://svs.gsfc.nasa.gov/5147/`
- Arquivos baixados e verificados:
  - `MC01_stage3_GMAO_near_surface_temperature_2048x1024_en.mp4` (salvo como `svs5147_temp_2048x1024.mp4`, ~32 MiB).
    - Resolução verificada no Chrome: **`2048×1024`**, duração **`31 s`**, codec **`avc1` (H.264)**.
  - `NearSurfaceTemperature_colorbar.png` (`528×165`, 15 KB).

### 1.4 SVS 5153 — *Carbon Monoxide (CO) — GEOS-CF*
- Página: `https://svs.gsfc.nasa.gov/5153/`
- Arquivos baixados e verificados:
  - `MC03_stage4_GMAO_CO_2048x1024_en.mp4` (salvo como `svs5153_co_2048x1024.mp4`, ~18 MiB).
    - Resolução verificada no Chrome: **`2048×1024`**, duração **`31 s`**, codec **`avc1` (H.264)**.
  - `CO_colorbar.png` (`528×125`, 8,1 KB).

### 1.5 SVS 5154 — *Nitrogen Oxides (NOx) — GEOS-CF*
- Página: `https://svs.gsfc.nasa.gov/5154/`
- Arquivos baixados e verificados:
  - `MC04_stage4_GMAO_NO2_2048x1024_en.mp4` (salvo como `svs5154_nox_2048x1024.mp4`, ~29 MiB).
    - Resolução verificada no Chrome: **`2048×1024`**, duração **`31 s`**, codec **`avc1` (H.264)**.
  - `NOx_colorbar.png` (`528×125`, 7,8 KB).

**Conclusão da Fase 1:** Todos os **5 datasets** possuem versões em projeção equiretangular 2:1 com codec H.264 (`avc1`), permitindo projeção alinhada pixel a pixel no globo 3D e no mapa 2D com compatibilidade nativa no navegador.

---

## 2. Caminhos Avaliados e Decisões Arquiteturais

### Caminho A — Usar os vídeos principais `1920×1080` / `4K` do SVS 5011 (Descartado)
- **Por que tentamos/avaliamos:** Era o link principal de download no topo da página SVS 5011.
- **Limitação encontrada:** O arquivo `iss_lightning_sphere_07312023.mp4` já traz a Terra pré-renderizada como uma esfera girando com câmera fixa. Não é possível mapear coordenadas geográficas nem dar zoom dentro de um país específico com controle livre.
- **Solução adotada:** Utilizar o arquivo da seção **Science on a Sphere (`4096×2048`)** da mesma página SVS 5011, que entrega o planeta inteiro em projeção equiretangular limpa.

### Caminho B — Streaming direto da URL da NASA SVS no WebGL (Descartado)
- **Por que avaliamos:** Evitaria baixar ~400 MB de vídeo no projeto local.
- **Limitação encontrada:** Texturas de vídeo em WebGL (`THREE.VideoTexture` / `texImage2D`) exigem cabeçalhos CORS (`Access-Control-Allow-Origin`) quando servidas de outro domínio, e o arquivo de 334 MiB causaria travamentos severos de rede ao dar *scrubbing* na linha do tempo durante apresentações ao vivo.
- **Solução adotada:** Download local em `public/nasa/` (`svs5011_lightning_sos_4096x2048.mp4` e `svs5148_wind_2048x1024.mp4`), garantindo reprodução rápida, *seek* instantâneo e funcionamento **100% offline**.

### Caminho C — CesiumJS vs Leaflet/Mapbox vs Three.js + Shaders Customizados (Escolhido: Three.js Custom)
- **CesiumJS / Mapbox com tiles de satélite externos:**
  - *Prós:* Tiles de satélite em altíssima resolução.
  - *Contras para este caso:* Requer conexão com internet/chaves de API para tiles externos, e renderizar dois vídeos HTML5 simultâneos com *blending* por shader customizado e transição fluida 3D ↔ 2D no Cesium exige contornar limitações do `SingleTileImageryProvider`.
- **Three.js com Geometria Morfável (`3D ↔ 2D`) + `world-atlas` TopoJSON offline (Escolhido):**
  - *Prós:* Controle total por shader GLSL sobre as duas `THREE.VideoTexture` (`5011` e `5148`), morfismo suave entre globo 3D e mapa plano 2D mantendo as mesmas coordenadas, fronteiras vetoriais nítidas (`countries-50m.json`) mesmo em zoom dentro de países e operação 100% offline.

---

## 3. Problemas Encontrados e Correções Aplicadas Durante o Desenvolvimento

### Problema 1 — Erro de precisão IEEE-754 em `formatVideoTime(31.4)`
- **Como foi descoberto:** O teste unitário `src/__tests__/playerMath.test.ts` falhou na primeira execução:
  - Esperado: `'00:31.4'`
  - Obtido: `'00:31.3'`
- **Causa raiz:** Em JavaScript, `(31.4 % 1) * 10` resulta em `3.999999999999986`, e `Math.floor` truncava para `3`.
- **Correção (`src/utils/playerMath.ts`):** Cálculo convertido para décimos inteiros com tolerância (`Math.floor(seconds * 10 + 1e-6)`). Todos os 13 testes unitários passaram após a correção.

### Problema 2 — Closure desatualizada de `video5011` / `video5148` no loop `requestAnimationFrame`
- **Como foi descoberto:** Revisão de fluxo antes da execução no navegador: o `useEffect` principal do WebGL rodava apenas na montagem (`[allRings, countries]`), capturando `video5011` e `video5148` inicialmente como `null` dentro de `animate()`.
- **Correção (`src/components/EarthCanvas.tsx`):** `video5011` e `video5148` passaram a ser lidos via `propsRef.current` dentro do loop `animate()`.

### Problema 3 — Rótulo órfão `"Ashmore and Cartier Is."` preso no canto superior esquerdo `(0, 0)`
- **Como foi descoberto:** Inspeção visual das capturas de tela iniciais no Google Chrome headless (`shot1`, `shot2`, `shot3`).
- **Causa raiz:** Em `world-atlas/countries-50m.json`, geometrias sem `id` numérico distinto ou com `id` compartilhado causavam sobrescrita no `Map<string, HTMLDivElement>` (`labelDivs.set(country.id, el)`), deixando elementos DOM anteriores sem atualização de `transform`/`opacity` no canto `(0, 0)`.
- **Correção (`src/geo/countries.ts` e `src/components/EarthCanvas.tsx`):**
  - Geração de ID garantidamente único por feature: `` `${feat.id ?? nameEn}-${featIdx}` ``.
  - Inicialização explícita de `el.style.opacity = '0'` na criação dos rótulos.
  - Ajuste do corte de horizonte em 3D (`dot < 0.36`) para evitar acúmulo de nomes na borda do globo.
- **Verificação:** Re-executado no Chrome headless com `ORPHAN_LABELS_AT_ORIGIN: []` e confirmado visualmente nas capturas atualizadas.

### Problema 4 — Loop infinito de re-renderização no React 18 com `ref` inline em 5 vídeos
- **Como foi descoberto:** Ao expandir de 2 para 5 elementos `<video>` via `.map(...)` em `src/App.tsx`, o Chrome acusou `Error: Maximum update depth exceeded` no carregamento inicial.
- **Causa raiz:** A callback inline `ref={(el) => setVideoRef(id, el)}` mudava de identidade a cada render, fazendo o React 18 desanexar (`null`) e reanexar o `ref` em ciclo contínuo enquanto `setVideoElements` disparava novas renderizações.
- **Correção (`src/App.tsx`):** `setVideoRef` passou a atualizar apenas `videoRefs.current[id] = el` (sem `setState`), e `setVideoElements({ ...videoRefs.current })` passou a ser sincronizado uma única vez no `useEffect` de montagem. A arquitetura do shader em `EarthCanvas.tsx` também foi generalizada de 2 texturas fixas (`5011`/`5148`) para um par dinâmico `uBaseTex` + `uOverlayTex` com cache de `THREE.VideoTexture`, permitindo combinar qualquer par dentre os 5 datasets.

---

## 4. Testes Executados e Resultados Obtidos

### 4.1 Testes Unitários (Vitest)
Comando: `npm test` (`vitest run`)
- `src/__tests__/projection.test.ts`: **5/5 passou**
  - Mapeamento `(0°, 0°)` para `+Z` na esfera e centro no plano 2D.
  - Ida e volta (`lonLatToSphere` ↔ `spherePointToLonLat` e `lonLatToFlat` ↔ `flatPointToLonLat`) para Brasil, Japão, EUA e Reino Unido.
  - Validação da geometria morfável (`position`, `aFlatPosition`, `uv`, `index`).
  - Descarte de segmentos que cruzam o antimeridiano (`|dlon| > 180°`).
  - Formatação de hemisférios N/S/E/W.
- `src/__tests__/countries.test.ts`: **4/4 passou**
  - Carregamento offline de >200 países e >300 anéis vetoriais (`countries-50m.json`).
  - Centroides continentais validados para Brasil, EUA e Japão.
  - Busca bilíngue PT-BR/EN (`"Brasil"`, `"Japao"`, `"Germany"`).
  - Lookup ponto-em-polígono: Brasília (`-47.9, -15.8`) retorna `Brazil`; Atlântico (`-30, 0`) retorna `null`.
- `src/__tests__/playerMath.test.ts`: **4/4 passou**
  - Formatação `MM:SS.d`, *clamping* de tempo, avanço/recuo de quadro e cálculo de distância de zoom por tamanho do país.

- `src/__tests__/datasets.test.ts`: **1/1 passou**
  - Registro completo dos 5 datasets (`svs5011`, `svs5147`, `svs5148`, `svs5153`, `svs5154`), caminhos locais `/nasa/*.mp4`, projeção `2:1` e colorbars.

**Resultado consolidado:** **4 arquivos de teste, 14 testes passando (0 falhas).**

### 4.2 Verificação de Build e Tipagem TypeScript
Comando: `npm run build` (`tsc -b && vite build`)
- **Resultado:** Exit code `0`, zero erros de TypeScript.
- Bundle gerado em `dist/` (`index.html` 0,45 kB, CSS 9,26 kB, JS 1.415,50 kB).

### 4.3 Testes Automatizados End-to-End no Google Chrome (Headless + WebGL + CDP)
Executado em Google Chrome real (`1440×900`, WebGL ativo via ANGLE/SwiftShader) contra o servidor Vite (`http://localhost:5173/`):

1. **Carregamento e decodificação de todos os 5 vídeos MP4 no `<video>` + WebGL:**
   - `svs5011_lightning_sos_4096x2048.mp4`: `readyState: 4`, `4096×2048`, `duration: 100.033333 s`, `error: null`.
   - `svs5147_temp_2048x1024.mp4`: `readyState: 4`, `2048×1024`, `duration: 31 s`, `error: null` (reprodução verificada até `currentTime: 1.205 s`).
   - `svs5148_wind_2048x1024.mp4`: `readyState: 4`, `2048×1024`, `duration: 31 s`, `error: null`.
   - `svs5153_co_2048x1024.mp4`: `readyState: 4`, `2048×1024`, `duration: 31 s`, `error: null`.
   - `svs5154_nox_2048x1024.mp4`: `readyState: 4`, `2048×1024`, `duration: 31 s`, `error: null`.
2. **Alinhamento Geográfico (Inspeção Visual):**
   - Capturas analisadas confirmam alinhamento exato das fronteiras vetoriais (`countries-50m.json`) com o contorno da América do Sul, foz do Amazonas, Nordeste brasileiro, costa oeste africana e litoral europeu (Península Ibérica, Itália, Reino Unido) em todas as 5 camadas.
3. **Busca e Zoom dentro do País (`Brasil` e preset `Europa`):**
   - Busca por `"Brasil"` + zoom atingiu `distance: 1.3426` (`Alt. aprox.: 2.214 km` / `2.060 km`) com leitura de cursor `10.37° S, 56.18° W • Brasil`.
   - Preset `Europa` no SVS 5154 (`NOx`) e no modo sobreposição (`5148 + 5153`) exibiu claramente os corredores urbanos europeus alinhados com as fronteiras.
4. **Navegação (Pan por arraste):**
   - Arraste simulado de `(720, 450)` para `(840, 400)` produziu variação suave da câmera (`dLon: -9.025°`, `dLat: -3.752°`).
5. **Player e Sobreposição Dinâmica (`5011 + 5148` e `5148 + 5153`):**
   - Reprodução simultânea em modo sobreposição, alternância `3D Globo` ↔ `2D Mapa` e passo quadro a quadro (`1.2026 -> 1.237033 s`) validados sem erros.
6. **Erros de Runtime:**
   - `RUNTIME_EXCEPTIONS: []` (zero exceções JS ou WebGL durante todo o fluxo).

### 4.2 Ciclo Final — Acessibilidade, Máscara por País, Card de Logística, Mixer 5 Camadas e Correção de Layout (`task-252`)

1. **Bug #3 — Loop infinito ao registrar refs dinâmicas de 5 vídeos (`Maximum update depth exceeded`):**
   - Ao escalar de 2 para 5 tags `<video>` com callbacks inline de `ref` atualizando estado React no primeiro frame, o React 18 disparou ciclo repetido de renderização.
   - **Correção:** Atribuição direta em `videoRefs.current[id] = el` com sincronização única via `useEffect(..., [])`.

2. **Bug #4 — Sobreposição da barra superior sobre o card direito em `A+115%` Alto Contraste:**
   - Na inspeção visual de `shot_a11y_high_contrast.png`, quando a escala tipográfica foi elevada para `A+115%`, a `.top-hud` quebrou em duas linhas e invadiu o canto superior direito, encostando no botão de fechar (`×`) do `CountryDetailCard` porque ambos usavam `position: absolute` independentes.
   - **Correção:** Refatoração de `src/App.tsx`, `src/components/HudOverlay.tsx` e `src/index.css` para uma grade flex vertical (`.hud-chrome` -> `.top-hud` + `.hud-middle` + `PlayerBar`), mantendo os painéis laterais e o rodapé sempre livres de colisão em qualquer escala de fonte (`A+100%` a `A+130%`).

3. **Arquitetura de Acessibilidade, Enquadramento e Compositor 5 Camadas:**
   - **Acessibilidade (`src/accessibility/a11yEngine.ts`):** Narração em PT-BR via Web Speech API (`V`, `R`), sonificação via Web Audio API (`S`), região `aria-live="polite"`, alto contraste WCAG AAA (`C`), escala `A+100%`–`A+130%`, navegação completa por teclado (`Setas`, `+`/`-`, `Espaço`, `Esc`) e leitura amostrada de pixels RGBA do vídeo sob o cursor (`sampleVideoAtLonLat` / `interpretDatasetRgb`).
   - **Máscara e Enquadramento (`src/geo/countryMask.ts`, `src/components/EarthCanvas.tsx`):** Rótulos reduzidos para `9.5px` com prevenção de sobreposição; ao selecionar um país, `createCountryMaskTexture` rasteriza máscara equiretangular em `CanvasTexture` (`uMaskTex`) escurecendo o entorno (~76%) e `camera.setViewOffset` desloca o país para a esquerda, liberando a direita para o `CountryDetailCard` (`src/components/CountryDetailCard.tsx` + `src/geo/countryLogistics.ts`).
   - **Mixer Multi-Camadas (`EarthCanvas.tsx`):** Até 5 texturas simultâneas (`uTex0`–`uTex4`) reordenáveis com opacidade individual (`0–100%`) e 6 modos GLSL (`normal`, `screen`, `add`, `multiply`, `overlay`, `difference`).

4. **Bateria Final Após a Última Edição (`npm test` + `npm run build` + Chrome Headless):**
   - **Vitest (`npm test`):** **5 arquivos de teste, 18/18 testes aprovados** em `3.17s` (`playerMath.test.ts` 4, `datasets.test.ts` 1, `projection.test.ts` 5, `countries.test.ts` 4, `a11yAndMask.test.ts` 4).
   - **Build de produção (`npm run build`):** `tsc -b && vite build` concluído em `11.91s` (`1602` módulos transformados; `dist/index.html` `0.45 kB`, `dist/assets/index-Dfk7Va6u.css` `12.95 kB`, `dist/assets/index-Ba5MeY-C.js` `1,448.07 kB` / gzip `425.36 kB`).
   - **Chrome E2E Headless (`verify_chrome.mjs`):**
     - `BRAZIL_MASK_AND_CARD`: `hasCard: true`, `cardTitle: "Brasil"`, `viewOffsetX: 0.038`, `liveTextLen: 546` (anúncio acessível via `aria-live`).
     - `FIVE_VIDEOS_STACKED`: todos os 5 vídeos (`svs5011`, `svs5147`, `svs5148`, `svs5153`, `svs5154`) simultaneamente ativos em reprodução com `readyState: 4` e `paused: false`.
     - `HIGH_CONTRAST_ACTIVE: true` com inspeção visual das capturas confirmando ausência de sobreposição entre `.top-hud` e `.country-detail-card` em `A+115%`.
     - `RUNTIME_EXCEPTIONS: []`.

### 4.3 Unificação com EARTHSONG (`ErickRaposo/NSA-Carranqueiros`), Skills UI/UX e Melhoria de Resolução HD (`Opção A`)

1. **Skills UI/UX Instaladas e Aplicadas (`.agents/skills/`):**
   - Instaladas `ui-ux-pro-max` (`nextlevelbuilder/ui-ux-pro-max-skill`) e `frontend-design` (`anthropics/skills`), aplicando regras de contraste WCAG AAA, rótulos explícitos e alertas focáveis em formulários (`role="alert"`, `tabIndex={-1}`), suporte a `prefers-reduced-motion`, `ResizeObserver` e descarte completo de geometrias/materiais WebGL em `Astronaut3D.tsx`.

2. **Fluxo Unificado Pós-Login (`AuthLayout` -> `IntroOnboarding` -> `EarthExplorerView`):**
   - **Autenticação (`src/auth/authStorage.ts`, `src/components/AuthLayout.tsx`, `src/pages/LoginPage.tsx`, `RegisterPage.tsx`):** Persistência local em `localStorage` (`admin`/`12345`, cadastro e botão **Entrar como Visitante (Demonstração)**), arte oficial quadrada gerada em `public/banner.png` (`1024×1024`) + barra de acessibilidade (`Ouvir tela`, `Contraste`, `A+`) já disponível antes do login.
   - **Onboarding & Copiloto 3D (`src/components/IntroOnboarding.tsx`, `src/components/Astronaut3D.tsx`, `src/components/AstronautCopilot.tsx`):** Fluxo interativo em 4 etapas após o login com atalho **Pular para o Mapa (Esc)**; na tela principal (`src/components/EarthExplorerView.tsx`), o Astronauta 3D permanece como widget colapsável **Guia Orbital 3D**, reagindo à leitura em voz PT-BR e ao país selecionado, além de controles de **Tour** e **Sair** no cabeçalho (`HudOverlay.tsx`).
   - **Tailwind CSS v4 + Tipografia Unificada:** Adotadas as fontes `Space Grotesk` + `Plus Jakarta Sans` e `@tailwindcss/vite` com `@import "tailwindcss" source("../src")` em `src/index.css` (evitando varredura dos ~478 MiB de MP4s em `public/nasa/` durante o build).

3. **Melhoria de Resolução nos Mapas (`Opção A` — GPU + Vetores em Tempo Real):**
   - **Auditoria da Fonte NASA SVS:** Confirmado que o `SVS 5011` já usa a maior resolução esférica equiretangular (`4096×2048`) e que os conjuntos `SVS 5147`, `5148`, `5153` e `5154` foram publicados originalmente pela NASA apenas em `2048×1024`.
   - **Shader Bicúbico + CAS (`EarthCanvas.tsx`):** Substituída a amostragem bilinear padrão por reconstrução **bicúbica B-spline 4-tap + nitidez adaptativa por contraste (CAS)** em GLSL sobre `uTex0`–`uTex4`, controlada em tempo real pelo botão **`HD GPU (H)`** sem alterar os valores de cor científicos da NASA.
   - **Vetores `10m` + Máscara `4K` + Malha Mais Densa:** Fronteiras migradas de `countries-50m.json` para `world-atlas/countries-10m.json` (`3,5 MB`), máscara territorial ampliada de `1024×512` para `4096×2048` e malha esférica elevada de `144×72` para `192×96` segmentos.

4. **Bateria Final Unificada (`npm test` + `npm run build` + `verify_unified.mjs`):**
   - **Vitest (`npm test`):** **6 arquivos de teste, 20/20 testes aprovados** em `14.31s` (`playerMath.test.ts` 4, `authStorage.test.ts` 2, `datasets.test.ts` 1, `projection.test.ts` 5, `countries.test.ts` 4 com `10m`, `a11yAndMask.test.ts` 4).
   - **Build de produção (`npm run build`):** `tsc -b && vite build` concluído sem erros em `29.93s` (`1611` módulos; `dist/index.html` `0.88 kB`, `dist/assets/index-C1VcJupN.css` `39.16 kB`, `dist/assets/index-DDdhHtmu.js` `4,419.73 kB` incluindo `countries-10m.json`).
   - **Chrome E2E Headless (`verify_unified.mjs`):**
     - `STEP_1_LOGIN`: `h1: "Entrar"`, `bannerLoaded: true` (`1024px`), `hasGuestBtn: true`.
     - `STEP_2_ONBOARDING`: `onboardingVisible: true`, `Astronaut3D` WebGL renderizado (`canvasCount: 2`).
     - `STEP_3_MAP_AND_COPILOT`: `cardTitle: "Brasil"`, `hasCopilot: true`, `hdActive: true`, `userPill: "Administrador"`, `overlapTopAndCard: false`, `overlapCopilotAndSide: false`, alternância do botão `HD GPU (H)` sem erros.
     - `STEP_4_F5_PERSISTED`: `persistedInMap: true` após recarregar a página.
     - `STEP_5_LOGOUT_AND_GUEST`: logout limpo + entrada como Visitante (`guestInOnboarding: true`, `greeting: true`).
     - `RUNTIME_EXCEPTIONS: []`.

### 4.4 Redesign Console Cartográfico, Ícones Autorais e Auditoria Visual

1. **Revisão pelas Skills `frontend-design` + `ui-ux-pro-max` e Subagente `frontend-architect`:**
   - **Remoção de estética genérica ("cara de IA"):** Eliminados cartões arredondados excessivos (`14–16px` / `999px`), gradientes saturados (`#0284c7 -> #2563eb`), acentos roxos fora da paleta (`#a78bfa`), marcadores repetidos (`•`) e subtítulos decorativos em caixa alta.
   - **Console Arquitetural (`src/index.css`):** Introduzidos tokens `--surface-console`, `--surface-sub`, `--hairline`, `--radius-frame: 4px` e `--radius-ctrl: 2px`, divisórias `1px` entre grupos da barra superior (`.toolbar-divider`), grade tabular `2×2` de métricas em `CountryDetailCard.tsx` com seções numeradas (`01`, `02`, `03`), stepper vertical conectado de zoom (`42×42px`), atalhos regionais em grade `2×3` dentro do Mixer (`.presets-ledger`) e faixa de telemetria acoplada diretamente ao topo do `PlayerBar` (`.bottom-console-dock`).
   - **Alvos Táteis e Contraste:** Placeholder da busca elevado para `#94a3b8` (`>= 4,5:1`), botões `.icon-btn` ampliados para `34×34px` e `.tiny-icon-btn` para `26×26px`, mantendo intacto o tema WCAG AAA (`.app-shell.high-contrast`).

2. **Ícones Cartográficos Autorais (`src/components/CartographicIcons.tsx`):**
   - Criado conjunto SVG próprio com traço técnico `1.6px`: `OrbitalReticleIcon`, `SharpenKernelIcon`, `EvaHelmetIcon`, `LightningBoltIcon`, `IsothermIcon`, `WindBarbIcon`, `SpectralBandIcon`, `No2MoleculeIcon`, `PolygonBorderIcon` e `GraticuleIcon`, substituindo os ícones genéricos em `HudOverlay.tsx`, `CountryDetailCard.tsx` e `AstronautCopilot.tsx`.

3. **Bateria Final Após o Redesign (`npm test` + `npm run build` + `verify_unified.mjs`):**
   - **Vitest (`npm test`):** **6 arquivos de teste, 20/20 testes aprovados** em `8.05s`.
   - **Build de produção (`npm run build`):** `tsc -b && vite build` concluído sem erros em `37.38s` (`1612` módulos; `dist/index.html` `0.88 kB`, `dist/assets/index-Cx8c-jYP.css` `42.76 kB`, `dist/assets/index-DzJ0X1zi.js` `4,421.84 kB`).
   - **Chrome E2E Headless + Inspeção Visual (`verify_unified.mjs`):** Todos os 5 estágios aprovados (`STEP_1_LOGIN` a `STEP_5_LOGOUT_AND_GUEST`), zero sobreposições (`overlapTopAndCard: false`, `overlapCopilotAndSide: false`), `RUNTIME_EXCEPTIONS: []` e captura visual (`shot_unified_3_map_copilot.png`) confirmando cabeçalho do Mixer em linha única, atalhos sem cortes e barra inferior unificada.

### 4.5 Earth Information Jukebox 1:1, Motor Musical 5-Stems, Desbloqueio Coletivo & Mascote MINEIRØ

1. **Integração com `origin/main` (Mascote 3D `MINEIRØ` + Voz PT-BR Masculina Natural):**
   - Incorporados via merge os commits `af35cf6` (`add mineiro`) e `5f8471b` (`add mascote em todas as pgs`), adicionando `Mineiro3D.tsx`, `MineiroOrbIcon`, `symboll.png`, `mineiro-logo.png`, seleção aprimorada de voz PT-BR em `a11yEngine.ts` e o guia `MINEIRØ // Guia` em `HudOverlay.tsx`, `AstronautCopilot.tsx` e `IntroOnboarding.tsx`.

2. **Motor Musical Determinístico 5-Stems & Amostrador Geográfico (`src/audio/soundscapeEngine.ts`):**
   - Implementada análise geoespacial determinística por **País** ou **Raio geográfico (`300–2500 km`)** (`sampleSoundscapeStats`, `deriveMusicalParameters`, `getTargetBounds`), derivando em tempo real as 5 camadas do pipeline NASA:
     - **Melodia (Raios ISS · SVS 5011):** notas pentatônicas em `Y` com *pan* estéreo em `X` (L/R real).
     - **Harmonia (Monóxido CO · SVS 5153):** seleção de modo (Lídio, Jônio, Dórico, Eólio) e extensões `7ª/9ª`.
     - **Ritmo (Temperatura · SVS 5147):** pulso de `68 a 108 BPM` sincronizado ao índice térmico.
     - **Baixo (Óxidos de Nitrogênio NO₂ · SVS 5154):** *Sub-Drone*, *Pulsante* ou *Urbano* com frequência de corte em `Hz`.
     - **Efeitos (Ventos · SVS 5148):** sopro harmônico afinado, *Chorus*, *Ping-Pong Delay* e *Hall Reverb* (`Wet %`).
   - Síntese Web Audio aditiva real (`SoundscapeSynthPlayer`) + narração explicativa completa (`buildExplainMusicPt`, tecla `E`).

3. **Mapa de Iluminação Coletiva & Sobreposição Visual 1:1 (`src/community/unlockStore.ts`, `src/geo/unlockMapTexture.ts`, `src/components/EarthCanvas.tsx`):**
   - Regra coletiva preservada: **1 conta desbloqueia 1 stem por região**; 5 contribuições distintas acendem os 5 stems e iluminam progressivamente os países na textura equiretangular `2048×1024` do globo/mapa (`0/5` apagado -> `1/5–4/5` ciano -> `5/5` dourado).
   - Camada 2D projetada em `60fps` sobre o globo 3D e mapa 2D (`earth-fx-overlay`): miras douradas nos clarões + nota, isolinhas âmbar de CO + acorde, anéis térmicos solares pulsando ao BPM, contorno esmeralda de NO₂ + frequência `Hz`, corredores celestes de vento + `Wet %`, e arco geodésico tracejado no modo Raio.
   - Acesso rápido de demonstração: botão **Modo Júri — Jukebox Coletiva (Sem Login)** no login entrando direto em **Brasil (`1/5`)**, além de **"+1 Coletivo"** e **"Liberar Tudo (Júri)"** em `JukeboxPanel.tsx`.

4. **Testes Unitários, Build & E2E Pós-Merge:**
   - **Vitest (`npm test`):** **8 arquivos de teste, 26/26 testes aprovados** (incluindo `soundscapeEngine.test.ts` e `unlockStore.test.ts`).
   - **Build de produção (`npm run build`):** `tsc -b && vite build` concluído sem erros (`1617` módulos; `dist/assets/index-B9gYzSxR.js` `4,460.74 kB`, `dist/assets/index-BVSgIr0_.css` `47.87 kB`).
   - **Chrome E2E Headless (`verify_jukebox_e2e.mjs`):** `STEP_1_LOGIN_JURY_BTN` a `STEP_4_RADIUS_MODE` aprovados com zero sobreposições (`overlapTopAndCard: false`) e `RUNTIME_EXCEPTIONS: []`, validados visualmente em `shot_jukebox_4_radius_mode.png`.

### 4.6 Transformação Planetária Sensorial, Gamificação & Audio-Reatividade (Etapas 1–5)

1. **Portal de Entrada Cinematográfico & HUD Full-Bleed (`src/components/EntryPortal.tsx`, `src/App.tsx`, `src/components/HudOverlay.tsx`):**
   - Criado `EntryPortal.tsx` com campo estrelado, anéis orbitais, mascote `Mineiro3D`, *"O planeta está esperando para ser ouvido."*, CTA **"EXPLORAR A TERRA"** (entrada imediata como Explorador sem barreira de cadastro), prévia sonora opcional em acorde `F#m9` (`Ouvir prévia sonora`), acesso **Modo Júri** e entrada de conta opcional (**"Entrar / Conta"**).
   - O globo 3D/2D (`EarthCanvas.tsx`) passou a ocupar `100vw × 100vh` em tela cheia por trás de uma barra lateral rápida colorida (`launchpad-floating-dock` de `68 px` com as 5 frequências e expansor *Camadas Vivas*), pílula de progresso coletivo + XP no topo e `Planeta Vivo` retrátil automaticamente quando um dossiê regional está aberto.

2. **Gamificação Orgânica Antiespam & 5 Missões NASA (`src/game/progressionStore.ts`, `src/components/AstronautCopilot.tsx`):**
   - Implementada progressão com XP concedido **uma única vez por região distinta** (`exploredRegionKeys`, bloqueando farm por cliques repetidos), patentes (*Ouvinte Orbital*, *Cartógrafo Sonoro*, *Maestro Atmosférico*, *Guardião da Sinfonia*), conquistas e 5 missões baseadas em limiares reais da NASA (*Caçador de Raios*, *Mestre dos Ventos*, *Pulso Térmico*, *Ecos Invisíveis* e *Guardião Planetário*).
   - Regra coletiva preservada integralmente: 1 stem por conta por região e 5 vozes para sinfonia completa.

3. **Motor Áudio-Reativo WebGL & Acessibilidade Sensorial (`src/audio/soundscapeEngine.ts`, `src/components/EarthCanvas.tsx`, `src/components/PlayerBar.tsx`):**
   - Inserido `AnalyserNode` e controle de volume master (`setMasterVolume`, `getAudioReactiveBands`, `computeAudioBandsFromBins`) conduzindo o sistema de partículas atmosféricas GPU (`THREE.Points` com as 5 cores das camadas NASA), aura orbital e barras de espectro vivas no `PlayerBar`.
   - Adicionados controle deslizante de volume, legenda sonora visual em tempo real (`Legenda sonora`), botão **"Pausar Movimento"** (respeitando também `prefers-reduced-motion`), alvos táteis `>= 44×44 px`, e suporte a `@media (prefers-contrast: more)` e `prefers-color-scheme`.

4. **Testes Unitários, Build & E2E Finais:**
   - **Vitest (`npm test`):** **9 arquivos de teste, 31/31 testes aprovados** (incluindo `progressionStore.test.ts` e banda FFT em `soundscapeEngine.test.ts`).
   - **Build de produção (`npm run build`):** `tsc -b && vite build` concluído sem erros (`1620` módulos; `dist/assets/index-Fw_ydiDk.js` `4,490.58 kB`, `dist/assets/index-dNEAgOTx.css` `72.19 kB`).
   - **Chrome E2E Headless (`verify_jukebox_e2e.mjs` e `verify_mobile_e2e.mjs`):** Portal de entrada (`shot_e2e_1_portal.png`), HUD *full-bleed* + Missões (`shot_e2e_2_fullbleed_missions.png`), Brasil `5/5` ao vivo + `Legenda sonora` + Volume (`shot_e2e_3_brazil_playing.png`), Raio + Alto Contraste `C` + Pausar Movimento (`shot_e2e_4_high_contrast_radius.png`) e Mobile `390×844` validados sem exceções de runtime (`RUNTIME_EXCEPTIONS: []`).

### 4.7 Evolução do Gameplay, Frequências Adormecidas & Redesign Terra Noturna Bioluminescente

1. **Reestruturação Regional, Frequências Adormecidas & Regra Real/Demo (`src/components/CountryDetailCard.tsx`, `src/components/JukeboxPanel.tsx`, `src/community/unlockStore.ts`, `src/game/progressionStore.ts`):**
   - Evoluído o painel regional em quatro blocos claros (*Identidade regional*, *Progresso da sinfonia*, *Frequências e descobertas*, *Próxima missão*) e gaveta retrátil secundária *Informações científicas* (`data-testid="scientific-info-details"`).
   - Separadas explicitamente a contagem real coletiva (`realUnlockedCount` / `realUnlockedStems`) da prévia demonstrativa do Modo Júri (`juryUnlockAll`) e das demonstrações individuais (*Prévia* identificada como demonstração audiovisual sem concessão de XP/desbloqueio).
   - Adicionados histórico local de contribuições (`contributionHistory` com deduplicação antiespam por `regionKey + stemId`) e contrato de sincronização (`ProgressionSyncAdapter`, `localProgressionAdapter`, `PROGRESSION_SYNC_NOTICE_PT`).

2. **Terra Noturna Bioluminescente & Enquadramento Orbital (`src/components/EarthCanvas.tsx`, `src/datasets/nasaDatasets.ts`):**
   - Shader `EARTH_FRAGMENT_SHADER` atualizado com *grading* noturno (`uHighContrast < 0.5`) que transforma continentes cinzentos desaturados dos mapas-base SVS em superfície índigo-obsidiana preservando integralmente plumas cromáticas da NASA, bordas ciano suaves (`#7dd3fc`) e atmosfera Fresnel.
   - Distância orbital inicial ajustada para `2.98` (`navRef` e `QUICK_PRESETS[0]`) mantendo ambos os polos visíveis no enquadramento inicial.

3. **Instrumento Espacial Flutuante, Cápsula Musical & Modo Zen (`src/components/HudOverlay.tsx`, `src/components/AstronautCopilot.tsx`, `src/components/PlayerBar.tsx`, `src/index.css`):**
   - `Planeta Vivo` passa a iniciar recolhido como pílula compacta no canto superior direito (`compactByDefault={true}`), mantendo controles de acessibilidade visíveis inclusive em telas `<= 900px`, corrigindo a grade de 3 abas (`planet-tabs-three`), removendo o quadrado cortado `44×44` e enviando `liveAnnouncement` exclusivamente para `sr-only`.
   - Top bar simplificada (ocultando `Sair` contraditório para sessão visitante, mantendo `Entrar` e adicionando **Modo Zen (`Z`)** via `zen-mode-btn` / `zen-exit-btn`); dock esquerdo reduzido às 5 áreas do Launchpad com micro-pips coloridos em *Freq.*.
   - `PlayerBar` condensado em cápsula flutuante centralizada com espectro de 5 vozes em linha única e popover *Ajustes de reprodução*; `impeccable detect --json src` zerado (`[]`) e animações de barra convertidas para `transform: scaleX(...)` GPU-composited.

4. **Testes & Validação Final Executada:**
   - **Vitest (`npm test`):** **9 arquivos de teste, 31/31 testes aprovados**.
   - **Build de produção (`npm run build`):** `tsc -b && vite build` sem erros (`1620` módulos; `dist/assets/index-BkY2XyDD.css` `83.43 kB`, `dist/assets/index-DEkbSd9d.js` `4,513.78 kB`).
   - **`impeccable detect --json src`:** `[]` (0 alertas).
   - **Chrome E2E Headless (`verify_final_e2e.mjs`):** verificados `PLANET_VIVO` (`sameRow: true`, `hasLogoutForGuest: false`), `CARD_BEFORE`, `AFTER_CONTRIB` (`Progresso da Sinfonia: 2/5 vozes reais`), `JURY_DEMO`, `COLECAO`, `FRANCE_5OF5`, Modo Zen e capturas visuais desktop `1440×900` e mobile `390×844`.

### 4.8 Execução das 4 Entregas da Auditoria de UX, Game Design & Exploração Planetária

1. **Entrega 1 — Planeta Vivo e Descoberta Imediata (`src/datasets/nasaDatasets.ts`, `src/components/EarthCanvas.tsx`, `src/components/EarthExplorerView.tsx`, `src/components/Mineiro3D.tsx`):**
   - Mix atmosférico inicial expandido em `DEFAULT_LAYER_STACK` (`svs5148` Ventos + `svs5153` CO + `svs5011` Raios ISS) e reprodução automática no carregamento inicial (`isPlaying = true`, respeitando `prefers-reduced-motion` e `motionPaused`).
   - Adicionados **Faróis Coletivos 3D** projetados no hemisfério visível do globo (`earth-fx-overlay`) com anel segmentado nas 5 cores musicais e crachá coroado (`1/5 vozes` até `5/5 ★ Sinfonia`), além de onda radial celebratória (`unlockPulseNonce`) ao despertar uma nova voz.
   - Reconectados o sensor orbital de cursor em tempo real (**Olho Orbital**, `hoverInfo` + `hoverReadings` + `approxAltKm`) e o botão **Guia** (`onReopenTour`).

2. **Entrega 2 — Arquitetura de Navegação Unificada & Companheiro `Mineiro3D` (`src/components/AstronautCopilot.tsx`, `src/components/HudOverlay.tsx`):**
   - Eliminada a duplicação entre esquerda e direita: o Launchpad esquerdo concentra a jornada pessoal do explorador em 4 áreas não sobrepostas (*Explorar*, *Frequências*, *Missões*, *Coleção*), enquanto a direita permanece dedicada ao **Planeta Vivo** (comunidade global, termômetro `unlockedVoicesCount/totalVoicesTarget`, Chamado Coletivo em destaque e lista de regiões).
   - Restaurado o avatar WebGL `Mineiro3D` com preset nativo `size="avatar"` (`62×62 px`, sem recorte CSS) no `Planeta Vivo`, com recolhimento contextual automático ao abrir um país (`compactByDefault={Boolean(soundscapeTarget)}`) e em viewports mobile (`<= 860px`), preservando os 4 controles globais de acessibilidade sempre visíveis.

3. **Entrega 3 — Frequências como Descobertas Sensoriais & Player 5-Vozes Interativo (`src/components/HudOverlay.tsx`, `src/components/PlayerBar.tsx`, `src/accessibility/a11yEngine.ts`):**
   - Adicionado `playStemPreviewSample(stemId)` com 5 motivos musicais Web Audio distintos (arpejo pentatônico, acorde atmosférico, pulso duplo térmico, sub-grave filtrado e brisa espacial).
   - Cartões de *Frequências* reestruturados como descobertas sensoriais com história do fenômeno, botão **Amostra**, contagem comunitária real, `colorbarUrl` oficial visível quando ativa e controles técnicos recolhidos em `<details>` (*Ajustes de Compositor & SVS*).
   - Convertidos os 5 indicadores `.spectrum-pill` do `PlayerBar` em `<button>` interativos acessíveis (`aria-pressed`, alternando *mute* de instrumento na região ou visibilidade da camada no globo livre).

4. **Entrega 4 — Experiência Regional Cinematográfica, Missões Acionáveis & Fluxo Contínuo (`src/components/JukeboxPanel.tsx`, `src/components/EarthCanvas.tsx`, `src/index.css`):**
   - Ajustado o enquadramento orbital ao selecionar países (`viewOffsetX = 0.115`, distância `idealDistance * 1.12`) preservando os fenômenos atmosféricos ao redor.
   - Adicionados botões de teleporte direto (*Investigar em ...*) nos cartões de *Missões*, botão de continuidade (*Despertar / Viajar para próxima região incompleta*) após contribuir na região atual, e realocação discreta dos controles de apresentação (*Prévia 5/5 (Júri)* e *+1 Coletivo*) para o rodapé secundário `.jury-tools-strip`.
   - Validado integralmente com `npm test` (`9/9` arquivos, `31/31` testes), `npm run build` (exit 0), `impeccable detect --json src` (`[]`) e E2E visual em Chrome headless (`e2e_1_living_globe.png` a `e2e_5_mobile_390x844.png`).

---

## 5. Limitações Conhecidas e Próximos Passos Possíveis

- **Resolução nativa dos vídeos NASA:** Os arquivos oficiais cobrem o globo inteiro em `4096×2048` (5011) e `2048×1024` (5147, 5148, 5153, 5154). O filtro **HD GPU (`Bicúbico + CAS`)**, a máscara `4096×2048` e o mapa vetorial `10m` aumentam significativamente a nitidez no zoom mantendo a fidelidade de cor científica; ganhos além disso dependeriam de modelos externos por IA (com risco de alterar cores da legenda) ou *tile streaming* em outra fonte.
- **Sincronização temporal entre camadas:** O SVS 5011 cobre 2017–2023 em `100.03 s`, enquanto os conjuntos GEOS-FP/GEOS-CF (`5147`, `5148`, `5153`, `5154`) têm duração de `31 s`; portanto, a sobreposição visual cruza padrões espaciais/atmosféricos entre as camadas escolhidas.
- **Tamanho do pacote local:** Por armazenar todos os 5 MP4s oficiais offline em `public/nasa/`, a pasta ocupa cerca de **478 MiB** no disco (já ignorada no `.gitignore` via `public/nasa/*.mp4`).
