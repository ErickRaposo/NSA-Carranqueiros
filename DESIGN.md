---
name: Earth Jukebox — Observatório Espacial & Quarto Projetado
description: Design System canônico do Earth Jukebox (NASA Space Apps — The Earth Information Jukebox), governando os 3 Mundos da instalação: (1) Controle Tablet & Demo Web em Ardósia-Obsidiana, (2) Cenas Projetadas #000000 em 2 Paredes + Teto e (3) Bancada Técnica de Setup.
colors:
  bgProjectionVoid: "#000000"
  bgPortalHero: "#02050d"
  bgVoid: "#060913"
  bgContentBand: "#040b1a"
  bgAuthDeep: "#07142e"
  bgAuthPanel: "#071126"
  bgObsidianIsland: "#060c1a"
  bgObsidianDrawer: "#080d19"
  bgInputDark: "#0c1a36"
  bgEditorialLight: "#f8fafc"
  inkEditorialDark: "#0a1a35"
  textPrimary: "#f8fafc"
  textSecondary: "#cbd5e1"
  textMuted: "#94a3b8"
  borderHairline: "#1e293b"
  borderPortalNavy: "#1e3a66"
  ctaWhite: "#ffffff"
  ctaOrbitalBlue: "#1d4ed8"
  ctaOrbitalBlueHover: "#2563eb"
  ctaAuthSubmit: "#1a3a7a"
  focusRing: "#7dd3fc"
  stemMelody: "#fbbf24"
  stemHarmony: "#fb923c"
  stemRhythm: "#fb7185"
  stemBass: "#34d399"
  stemFx: "#38bdf8"
  globeOcean: "#040d21"
  borderCoastCasing: "#020617"
typography:
  fontDisplay: "'Orbitron', 'Poppins', system-ui, sans-serif"
  fontSans: "'Poppins', system-ui, -apple-system, sans-serif"
  heroHeadline:
    fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif"
    fontSize: "2.35rem"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "0.02em"
  sectionTitle:
    fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.03em"
  drawerTitle:
    fontFamily: "'Poppins', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  bodyLead:
    fontFamily: "'Poppins', system-ui, sans-serif"
    fontSize: "0.96rem"
    fontWeight: 400
    lineHeight: 1.62
  hudLabel:
    fontFamily: "'Poppins', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
  telemetryMicro:
    fontFamily: "'Poppins', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  none: "0px"
  sm: "6px"
  md: "10px"
  lg: "12px"
  drawer: "18px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "36px"
  3xl: "64px"
components:
  portalPrimaryCta:
    backgroundColor: "{colors.ctaWhite}"
    textColor: "{colors.bgVoid}"
    typography: "{typography.hudLabel}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "46px"
  portalAccountBtn:
    backgroundColor: "{colors.ctaOrbitalBlue}"
    textColor: "{colors.ctaWhite}"
    typography: "{typography.hudLabel}"
    rounded: "{rounded.full}"
    padding: "0 18px"
    height: "40px"
  authSubmitBtn:
    backgroundColor: "{colors.ctaAuthSubmit}"
    textColor: "{colors.ctaWhite}"
    typography: "{typography.hudLabel}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "44px"
  orbitalIslandPill:
    backgroundColor: "{colors.bgObsidianIsland}"
    textColor: "{colors.textPrimary}"
    typography: "{typography.hudLabel}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
    height: "46px"
  obsidianDrawer:
    backgroundColor: "{colors.bgObsidianDrawer}"
    textColor: "{colors.textPrimary}"
    rounded: "{rounded.drawer}"
    padding: "13px"
    width: "368px"
  orbitalDarkInput:
    backgroundColor: "{colors.bgInputDark}"
    textColor: "{colors.textPrimary}"
    typography: "{typography.hudLabel}"
    rounded: "{rounded.md}"
    padding: "0 11px"
    height: "36px"
---

## Overview

O **MINEIRØ / EARTHSONG** (*NASA Space Apps Challenge — The Earth Information Jukebox*) adota a direção criativa de **Observatório Orbital Cinematográfico**. A linguagem visual une rigor científico de visualização de dados da NASA, emoção espacial e instrumentos musicais táteis — sem jamais parecer um painel corporativo genérico nem um HUD de RPG poluído.

O Design System governa duas superfícies complementares que compartilham a mesma identidade cromática, tipográfica e de acessibilidade:

1. **Superfície Institucional & Autenticação (`EntryPortal`, `AuthLayout`, `LoginPage`, `RegisterPage`):** narrativa cinematográfica de entrada sobre o espaço profundo (`#02050d`), horizonte terrestre iluminado, contraste editorial claro (`#f8fafc` com tinta marinho `#0a1a35`), tipografia monumental `Orbitron` nos títulos de seção e CTAs pílula de alto contraste (`#ffffff` e azul orbital `#1d4ed8`).
2. **Superfície Planetária — Globo 3D/2D, Mapa & HUD de Instrumentos Orbitais (`EarthExplorerView`, `EarthCanvas`, `HudOverlay`, `PlayerBar`, `PlayerHUD`, `AstronautCopilot`, `NasaDatasetCard`, `CountryDetailCard`):** onde **o Globo e o Mapa da NASA ocupam ~90% do protagonismo visual**. Todos os menus periféricos comportam-se como **instrumentos orbitais silenciosos em ardósia-obsidiana** (`rgba(6, 12, 26, 0.78)`), com hierarquia monocromática fria e **cores vivas reservadas estritamente aos 5 datasets científicos da NASA**.

**Governança e Evolução Passo a Passo:** este documento (`DESIGN.md`), seu sidecar estruturado (`.impeccable/design.json`) e as variáveis/classes em `src/index.css` formam a fonte única da verdade para o agente `mineiro-frontend` e para toda a equipe. Novas telas devem nascer 100% fiéis a estes padrões; qualquer necessidade de alterar tokens, componentes ou logística de fluxo deve ser proposta e alinhada passo a passo antes de modificar o sistema base.

## Colors

A arquitetura de cor separa rigorosamente **fundos espaciais**, **vidros de instrumento orbital**, **ações institucionais** e **semântica científica 1:1 dos 5 canais da NASA**.

### Fundos Espaciais, Editoriais e Superfícies de Vidro

| Token / Variável CSS | Valor | Onde aplicar |
| :--- | :--- | :--- |
| `bgPortalHero` | `#02050d` | Hero da landing page (`EntryPortal`) com campo estelar e horizonte da Terra |
| `bgVoid` (`--bg-void`) | `#060913` (`body`: `#040915`) | Fundo base do Explorador Planetário 3D/2D |
| `bgContentBand` | `#040b1a` | Faixas escuras institucionais (Pilares, Equipe e transição de seções) |
| Gradiente Split Auth | `linear-gradient(135deg, #030816 0%, #07142e 50%, #040b1c 100%)` | Coluna visual esquerda de `AuthLayout` com `HeroEarth3D` |
| `bgAuthPanel` | `rgba(7, 17, 38, 0.95)` (`#071126`) | Painel de formulário de Login/Cadastro e modais de recuperação |
| `bgEditorialLight` / `inkEditorialDark` | `#f8fafc` fundo / `#0a1a35` títulos / `#334155` texto | Seção institucional clara ("O que é o MINEIRØ?") para respiro editorial |
| Ilha Flutuante HUD (`bgObsidianIsland`) | `rgba(6, 12, 26, 0.78)` + `backdrop-filter: blur(16px)` | Cápsulas `999px` da Topbar, `PlayerHUD` fechado, `Órbita Global` e `PlayerBar` |
| Docks Verticais Laterais | `rgba(6, 12, 26, 0.72)` + `backdrop-filter: blur(16px)` | Estação esquerda (`Explorar/Estúdio/Missões/Diário`) e direita (`Voz/Som/Contraste/A+/Giro/Zoom`) |
| Gaveta / Popover (`bgObsidianDrawer`) | `rgba(8, 13, 25, 0.95)` + `backdrop-filter: blur(20px)` | Painéis expandidos `18px` (`Passaporte Planetário`, `Órbita Global`, `Estúdio`) |
| Card Interno Sutil | `rgba(255, 255, 255, 0.025)` | Faixas de telemetria, métricas internas e blocos de resumo sem peso visual |
| Inputs Escuros (`bgInputDark`) | `rgba(3, 7, 18, 0.65)` (HUD) / `#0c1a36` → foco `#122449` (Auth) | Campos de busca, formulários de perfil, senha e autenticação |

### Texto, Bordas Hairline e Estados de Ação

- **Hierarquia Tipográfica no Escuro:**
  - `textPrimary` (`--text-primary`): `#f8fafc` — títulos, valores numéricos principais, país selecionado e controles ativos.
  - `textSecondary` (`--text-secondary`): `#cbd5e1` — descrições curtas, rótulos de apoio e itens de lista em repouso.
  - `textMuted` (`--text-muted`): `#94a3b8` (`#64748b` apenas para kickers secundários não essenciais) — metadados, unidades e contadores discretos; **nunca usar texto abaixo de contraste WCAG AA (4.5:1)**.
- **Bordas Hairline:**
  - Padrão HUD (`--glass-border`): `1px solid rgba(148, 163, 184, 0.14)` a `rgba(148, 163, 184, 0.16)`.
  - Hover / Popover aberto: `1px solid rgba(148, 163, 184, 0.32)`.
  - Aba/controle ativo no HUD: fundo `rgba(255, 255, 255, 0.09)` a `rgba(255, 255, 255, 0.12)` com borda `1px solid rgba(226, 232, 240, 0.24)`.
  - Bordas estruturais do Portal/Auth: `#172745` e `#1e3a66`.
- **Ações Institucionais & Foco:**
  - CTA Primário Hero (`ctaWhite`): fundo `#ffffff`, texto `#060913`, hover `#e2e8f0`.
  - CTA Conta / Login (`ctaOrbitalBlue`): fundo `#1d4ed8`, texto `#ffffff`, hover `#2563eb`; variante contornada com borda `#2563eb` (hover `#60a5fa` e fundo `rgba(37, 99, 235, 0.14)`).
  - Submit Autenticação (`ctaAuthSubmit`): fundo `#1a3a7a`, hover `#234b9c`, texto `#ffffff`.
  - Ação Destrutiva Discreta (ex.: Sair da Conta): fundo `rgba(244, 63, 94, 0.05)`, borda `rgba(244, 63, 94, 0.2)`, texto `#fda4af`.
  - Anel de Foco Acessível (`focusRing` / `--focus-ring`): `2px solid #7dd3fc` com `outline-offset: 2px`.

### Semântica Científica Obrigatória — Os 5 Datasets NASA (`STEM_METAS`)

No Explorador Planetário, **cores saturadas não são decoração de interface**: elas pertencem exclusivamente aos 5 canais científicos da NASA (micro-dots de `6px`, pads do Estúdio, partículas orbitais de obsidiana e legendas científicas):

| Stem (`StemId`) | Instrumento | Fenômeno / Fonte Científica NASA | Hex Canônico |
| :--- | :--- | :--- | :--- |
| `melody` | **Melodia** | Raios Atmosféricos ISS LIS (`NASA SVS 5011` — evento discreto, sem barra contínua inventada) | `#fbbf24` (Ouro Solar) |
| `harmony` | **Harmonia** | Monóxido de Carbono CO (`NASA GEOS-CF / SVS 5153`) | `#fb923c` (Âmbar Atmosférico) |
| `rhythm` | **Ritmo** | Temperatura a 2m T2M (`NASA GEOS / SVS 5147`) | `#fb7185` (Coral-Rosa Térmico) |
| `bass` | **Baixo** | Óxidos de Nitrogênio NO₂ (`NASA GEOS-CF / SVS 5154`) | `#34d399` (Esmeralda Troposférica) |
| `fx` | **Efeitos** | Ventos a 10m (`NASA GEOS / SVS 5148`) | `#38bdf8` (Ciano Estratosférico) |

### Cartografia 3D/2D e Globo Planetário (`EarthCanvas`)

- **Esfera Oceânica Base (`globeOcean`):** `#040d21` com atmosfera Fresnel `#38bdf8` sutil.
- **Fronteiras de Duplo Contraste (Dual-Contrast Borders):** casing escuro `#020617` sob linhas costeiras `#cbd5e1` e divisas terrestres `#f8fafc`, garantindo leitura nítida país por país mesmo sobre mapas de calor amarelos/brancos da NASA a `100%` de opacidade.
- **Opacidade Científica das Camadas NASA:** quando **1 único mapa/stem** está ativo, sua textura de vídeo NASA renderiza com **100% de fidelidade visual** sobre o globo/mapa; quando múltiplas camadas são combinadas, o shader faz blend harmônico sem lavar as divisas políticas.
- **Obsidianas Orbitais Reativas:** partículas orbitando o planeta assumem dinamicamente as cores dos stems NASA ativos no momento (ex.: ligar `Baixo` desperta partículas `#34d399`).

## Typography

As fontes são carregadas via Google Fonts em `index.html`: **Orbitron** (`600, 700, 800`) e **Poppins** (`400, 500, 600, 700`).

- **`Orbitron` (`--font-display` Monumental — Uso Restrito ao Portal Institucional):**
  - Aplicada apenas em títulos de alto impacto da `EntryPortal` (`.entry-headline`, `.entry-section-title`, `.entry-team-title`) com `text-transform: uppercase` e `letter-spacing: 0.02em–0.04em`.
  - **Proibido** usar `Orbitron` em textos longos, formulários, tabelas, métricas ou dentro dos cards/gavetas densos do HUD Planetário.
- **`Poppins` (`--font-sans` — Fonte Principal de UI, HUD, Mapas e Leitura):**
  - Governa 100% do Explorador Planetário, botões, inputs, `AuthLayout`, corpo institucional e rótulos cartográficos.
  - **Alinhamento Numérico Obrigatório:** todo contador (`11/25`, `2/5`), coordenada geográfica (`43.02° S, 28.37° W`), cronômetro (`00:05.8/00:31.0`), XP e porcentagem deve aplicar `font-variant-numeric: tabular-nums` para impedir trepidação de layout.
- **Escala Tipográfica Prática:**
  - *Hero Institucional:* `clamp(1.6em, 2.7vw, 2.35em)` / `700` / `line-height: 1.16`.
  - *Título de Seção Portal:* `clamp(1.45em, 2.5vw, 2.15em)` / `700` / `line-height: 1.15`.
  - *Título de Painel / Gaveta HUD:* `13px` (`0.8125rem`) / `600` / `letter-spacing: -0.01em`.
  - *Valor Numérico em Faixa de Telemetria:* `14px` / `600` / `tabular-nums`.
  - *Controle / Pill / Aba HUD:* `11.5px–12.5px` / `600`.
  - *Metadados / Legendas Científicas:* `10.5px–11.5px` / `500`.
- **Escala Acessível (`fontScale`):** a raiz `.app-shell` e `.entry-portal` respeitam multiplicadores dinâmicos de fonte (`1` = 100%, `1.15` = 115%, `1.3` = 130%). Evite alturas fixas rígidas (`height` sem `min-height`) em blocos de texto para nunca truncar palavras quando `fontScale = 1.3`.

## Layout

### Arquitetura das Duas Zonas

1. **Portal Institucional (`EntryPortal`):**
   - Topbar sticky (`top: 0`, `z-index: 30`) transparente no topo e com fundo `rgba(3, 8, 20, 0.92)` + `backdrop-filter: blur(14px)` + borda `#132342` ao rolar (`.is-scrolled`).
   - Hero em grid assimétrico de 2 colunas (`minmax(0, 1.25fr) minmax(260px, 0.75fr)`, `max-width: 1220px`) com horizonte da Terra ancorado à base direita.
   - Seção institucional clara (`#f8fafc`, grid `1.1fr 0.9fr`, `max-width: 1180px`) com o mascote `Mineiro3D` orbitado pelos 5 chips dos instrumentos.
   - Seção de Equipe (`#040b1a`, grid de 3 colunas `max-width: 1040px`) e rodapé enxuto (`#040917`).
   - Breakpoints responsivos em `900px` (colapsa navegação para gaveta mobile `.entry-mobile-drawer` e empilha colunas) e `520px` (CTAs `width: 100%`).

2. **Autenticação Split-Screen (`AuthLayout`):**
   - Desktop (`lg:grid-cols-2`): metade esquerda dedicada ao globo interativo `HeroEarth3D` sobre gradiente azul-espacial profundo com botão pílula `Voltar ao início` no topo esquerdo; metade direita como painel de formulário `bg-[#071126]/95` com largura máxima interna `max-w-md` (`448px`).

3. **Explorador Planetário — Simetria Orbital de 6 Zonas (`EarthExplorerView`):**
   - **Canvas Full-Bleed (`100vw × 100vh`):** o globo 3D / mapa 2D ocupa toda a viewport; a camada `.hud-chrome` usa `pointer-events: none` no container e `pointer-events: auto` apenas nas ilhas interativas.
   - **Zona 1 — Topbar de 3 Ilhas (`top-hud`):** esquerda (marca `MINEIRØ` + busca geográfica), centro absolutamente centralizado em `50vw` (`3D / 2D / Satélite / Opções`), direita (cápsula de sessão `PlayerHUD` ou botão `Entrar`).
   - **Zona 2 — Estação Vertical Meio-Esquerda (`launchpad-floating-dock`):** centralizada em `top: 50%; transform: translateY(-50%)`, `width: 62px`, abrigando `Explorar`, `Estúdio`, `Missões` e `Diário`.
   - **Zona 3 — Foco Geográfico Contextual (`CountryDetailCard` + Mapa 2D Assimetricamente Enquadrado):** ao selecionar um país, a câmera enquadra o território à direita no mapa 2D enquanto o card informativo repousa à esquerda, ativando o **Modo Foco Puro (`.is-country-focus`)**: todo o HUD periférico recua para `opacity: 0.12` e restaura `opacity: 1` suavemente ao `:hover` ou `:focus-within`. Ao sair do país, a câmera retorna com zoom-out suave preservando o modo anterior (`3D` ou `2D`).
   - **Zona 4 — Estação Vertical Meio-Direita (`a11y-spatial-dock`):** espelha simetricamente a esquerda (`right: 14px`, `top: 50%`, `width: 62px`) com `Voz`, `Som`, `Contraste`, `A+`, `Girando` e `Zoom +/-`. Recua automaticamente (`opacity: 0; pointer-events: none`) quando `PlayerHUD` ou `Órbita Global` estão abertos para nunca sobrepor gavetas.
   - **Zona 5 — Console Sonoro Centralizado (`bottom-console-dock` + `PlayerBar`):** ancorado na base central (`50vw`), acoplado ao sensor `Olho Orbital` acima dele, contendo botão `Play` circular de ciclo NASA, botão de laboratório de escala científica (`NasaDatasetCard`), os 5 toggles dos stems, scrubber temporal, volume e `Compartilhar`.
   - **Zona 6 — `Órbita Global` (`bottom-right-collective-slot`):** pílula compacta no canto inferior direito (`width: clamp(214px, 16.8vw, 240px)`) com aba puxada de notificação ao vivo (`is-pull-tab`) para novos desbloqueios e gaveta `18px` de 2 abas (`Atividade` / `Ranking`).
   - Breakpoints do HUD: `1360px` (compacta controles centrais da topbar), `1140px` / `860px` (ajuste de largura do `PlayerBar`) e `760px` (gavetas mobile fixas com `left: 10px; right: 10px`).

## Elevation & Depth

A profundidade é construída por **translucidez de obsidiana, desfoque óptico calibrado e luz de borda interna**, nunca por sombras coloridas pesadas ou brilhos neon exagerados:

- **Nível 0 — Espaço / Globo (`z-index: 1–3`):** superfície WebGL/2D contínua sem molduras.
- **Nível 1 — Ilhas e Docks Periféricos (`z-index: 18–22`):** `background: rgba(6, 12, 26, 0.78)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(148, 163, 184, 0.16)`, `box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45)`.
- **Nível 2 — Gavetas, Popovers e Cards Científicos (`z-index: 19–35`):** `background: rgba(8, 13, 25, 0.95)`, `backdrop-filter: blur(20px)`, `border: 1px solid rgba(148, 163, 184, 0.16)`, `box-shadow: 0 24px 52px -12px rgba(2, 6, 20, 0.82), inset 0 1px 0 rgba(255, 255, 255, 0.04)`.
- **Nível 3 — Superfícies Internas Aninhadas:** `background: rgba(255, 255, 255, 0.025)` com borda hairline `rgba(148, 163, 184, 0.12)` e **zero `box-shadow`**. Nunca empilhe card pesado dentro de card pesado; prefira divisores hairline (`1px solid rgba(148, 163, 184, 0.1)`).

## Shapes

A geometria do MINEIRØ comunica imediatamente a função de cada elemento:

- **Cápsula Orbital (`999px`):** obrigatória para ilhas flutuantes de 1 linha (`top-hud-island`, `player-hud-trigger`, `collective-orbit-pill`, `orbital-eye-pill`), CTAs do Portal (`entry-primary-cta`, `portal-login-btn`, `portal-outline-btn`) e faders verticais (`pad-vertical-fader`).
- **Gaveta / Estação de Instrumento (`18px`):** obrigatória para todos os painéis expandidos, docks verticais laterais (`launchpad-floating-dock`, `a11y-spatial-dock`), pads do Estúdio (`organic-sound-pad`), `player-hud-popover`, `collective-bottom-sheet` e `inapp-robot-guide`.
- **Aba Puxada Acoplada (`15px 15px 0 0` + base `0 0 15px 15px`):** padrão exclusivo da notificação viva acoplada à `Órbita Global` (`collective-live-toast.is-pull-tab` + `collective-orbit-pill.is-toast-docked`), evitando toasts gigantes soltos na tela.
- **Bloco Interno / Card Científico (`12px`):** faixas de métricas de 3 colunas (`participant-metrics-strip`), resumos de telemetria e `nasa-dataset-card`.
- **Controles & Inputs (`8px–10px`):** botões de abas segmentadas (`participant-tab-btn`, `collective-tab-btn`), inputs de formulário (`participant-input`, inputs de `LoginPage`) e botões utilitários quadrados (`34px × 34px`, raio `9px`).
- **Micro-Indicadores Circulares (`50%`):** avatares (`22px`, `28px`, `36px`, `132px` na equipe) e pontos científicos de stem (`6px × 6px`).

## Components

### 1. Botões do Portal Institucional e Autenticação
- **Primário Luminoso (`.entry-primary-cta` / `.entry-about-cta`):** altura mínima `46px`, raio `999px`, fundo `#ffffff`, texto `#060913` (`Poppins 600`), sombra suave `0 8px 24px rgba(0, 0, 0, 0.35)`, hover `translateY(-1px)` + `#e2e8f0`. Na seção clara (`.entry-about-cta`), inverte para fundo `#0a1a35` e texto `#ffffff` (hover `#1d4ed8`).
- **Primário Conta Orbital (`.portal-login-btn`):** altura `40px`, raio `999px`, fundo `#1d4ed8`, borda `1px solid #2563eb`, texto `#ffffff`, hover `#2563eb`.
- **Secundário Contornado (`.portal-outline-btn` / `.entry-audio-btn`):** altura `40px–46px`, raio `999px`, fundo `rgba(8, 17, 36, 0.72)`, borda `1.5px solid #2563eb`, texto `#ffffff`, hover `rgba(37, 99, 235, 0.14)` + borda `#60a5fa`.
- **Utilitário Circular A11y (`.portal-icon-btn` / `.entry-social-btn`):** `40px × 40px`, raio `50%`, fundo `rgba(12, 23, 46, 0.85)`, borda `1px solid #1e3a66`, texto `#e2e8f0`.
- **Submit de Formulário Auth:** largura `100%`, raio `8px–10px`, fundo `#1a3a7a` (hover `#234b9c`), texto `#ffffff`, `font-weight: 500–600`, transição de `150ms`.

### 2. Cápsulas e Controles Segmentados do HUD Planetário
- **Trigger de Sessão / Ilha Compacta (`.player-hud-trigger`, `.collective-orbit-pill`):** 1 linha limpa, altura `40px–42px`, raio `999px`, avatar monocromático discreto (`26px–28px`), nome em `#f8fafc`, metadado secundário em `#94a3b8` (`tabular-nums`) e chevron rotacionável (`180deg` quando aberto). Sem barras de XP neon ou pílulas douradas chamativas na topbar.
- **Barra de Abas Segmentadas (`.participant-tabs-bar`, `.collective-tabs-bar`, `.segmented-control`):** container `rgba(255, 255, 255, 0.035)` com borda `1px solid rgba(148, 163, 184, 0.13)`, `padding: 3px`, raio `10px–11px`; botão ativo em `rgba(255, 255, 255, 0.09)` com borda `rgba(148, 163, 184, 0.22)` e texto `#f8fafc`.

### 3. Faixas de Telemetria e Formulários Internos (`Meus Dados` / `Passaporte`)
- **Faixa de 3 Colunas (`.participant-metrics-strip`):** container único `12px` em `rgba(255, 255, 255, 0.025)` dividido em 3 células com divisórias verticais hairline `1px solid rgba(148, 163, 184, 0.12)` — substitui grids pesados de múltiplos cards coloridos.
- **Barra de Progresso Hairline (`3px`):** trilho `rgba(148, 163, 184, 0.16)` e preenchimento monocromático `rgba(226, 232, 240, 0.72)` (ou cor do stem correspondente apenas quando representar diretamente um canal NASA).
- **Inputs e Selects do HUD (`.participant-input`):** altura `34px–36px`, raio `8px`, fundo `rgba(3, 7, 18, 0.65)`, borda `1px solid rgba(148, 163, 184, 0.2)`, texto `#f8fafc` (`12px`), foco `border-color: rgba(125, 211, 252, 0.65)` sem estourar brilho externo.

### 4. Pads Bioluminescentes do Estúdio & Card Científico NASA
- **Pad Sonoro (`.organic-sound-pad`):** raio `18px`, fundo `rgba(8, 15, 30, 0.78)` em repouso; quando habilitado (`.is-enabled`), mistura suavemente `12%` da cor `--pad-accent` do respectivo dataset NASA na superfície e `52%` na borda, acompanhado de fader vertical gestual (`32px × 76px`, `999px`).
- **Card de Literacia Científica (`NasaDatasetCard`):** exibe a fonte oficial NASA SVS, explicação acessível do fenômeno, seletor entre camadas e **escala fiel aos dados reais** — barra de cores ampla para grandezas contínuas (CO, Temperatura, NO₂, Ventos) e **legenda de evento discreto** para Raios ISS (`melody`), com ações claras de fechar ou inspecionar no mapa.

### 5. Acessibilidade Estrutural & Movimento (`WCAG 2.2 AA / AAA`)
- **Modo Alto Contraste (`.high-contrast`):** sobrescreve superfícies tanto no `.entry-portal` quanto no `.app-shell` para `#000000` / `#050505` com texto `#ffffff`, bordas sólidas `1.5px–2px solid #ffffff` e remoção total de sombras/transparências baixas.
- **Disciplina de Foco (`:focus-visible`):** todo controle aplica `:focus:not(:focus-visible) { outline: none }` para cliques de mouse limpos e `outline: 2px solid #7dd3fc; outline-offset: 2px` para navegação por teclado; o retorno programático de foco ao fechar popovers deve ocorrer quando acionado via teclado (`Escape` ou `Enter`/`Space` com `e.detail === 0`).
- **Curva e Movimento (`--ease-out-quint`):** `cubic-bezier(0.23, 1, 0.32, 1)` com durações curtas (`140ms–220ms`), feedback tátil `:active { transform: scale(0.98) }` e neutralização completa sob `@media (prefers-reduced-motion: reduce)`.

## Do's and Don'ts

### Do's (Faça sempre)
- **Preserve o protagonismo de ~90% do Globo 3D e Mapa 2D** nas telas de exploração; mantenha menus laterais e inferiores recolhidos ou silenciosos até que o usuário interaja.
- **Use a paleta ardósia-obsidiana (`rgba(6, 12, 26, 0.78)` / `rgba(8, 13, 25, 0.95)`) e bordas hairline (`rgba(148, 163, 184, 0.16)`)** para qualquer novo drawer, modal, onboarding ou painel interno do Explorador.
- **Restrinja as 5 cores vivas (`#fbbf24`, `#fb923c`, `#fb7185`, `#34d399`, `#38bdf8`)** à representação fiel dos 5 datasets científicos da NASA (micro-dots `6px`, pads do Estúdio, partículas orbitais e escalas científicas).
- **Aplique `font-variant-numeric: tabular-nums`** em todos os contadores, coordenadas, rankings, cronômetros e percentuais.
- **Implemente suporte completo a `.high-contrast`, `fontScale` (`1` / `1.15` / `1.3`), `prefers-reduced-motion` e copy em `pt-BR` claro** em toda nova tela ou componente.
- **Alinhe passo a passo com o usuário (e com `mineiro-cpo` em decisões de fluxo)** antes de alterar tokens globais, adicionar novas cores ou mudar a logística de navegação.

### Don'ts (Nunca faça)
- **Nunca crie cards gamificados estilo RPG/arcade** (gradientes dourados/roxos/verdes vibrantes, ícones `Sparkles` decorativos, coroas ou banners gigantes de notificação) que destoem dos instrumentos laterais.
- **Nunca invente escalas científicas inexistentes** (como gradiente contínuo para dados discretos de ocorrência de raios) nem reduza a opacidade de um mapa NASA ativo sozinho abaixo de `100%`.
- **Nunca use `Orbitron` dentro de parágrafos, inputs, tabelas ou painéis densos do HUD** — mantenha `Poppins` para legibilidade imediata.
- **Nunca aninhe múltiplos cards com sombra e borda grossa dentro de uma gaveta**; use faixas únicas sutis (`rgba(255, 255, 255, 0.025)`) e divisores hairline.
- **Nunca deixe painéis secundários sobreporem a estação direita (`a11y-spatial-dock`) ou cobrirem o país selecionado no Modo Foco Puro (`.is-country-focus`)**.
