# Linguagens, APIs Web e Tecnologias Utilizadas

Este documento lista de forma transparente todas as linguagens, APIs nativas do navegador e bibliotecas empregadas no **NASA SVS Earth Video Explorer**, explicando o papel de cada uma — com atenção especial aos recursos de acessibilidade para pessoas com deficiência visual.

---

## 1. Linguagens de Programação, Marcação e Shaders

| Linguagem | Onde é usada | Papel no Sistema |
| --- | --- | --- |
| **TypeScript (`TS` / `TSX`)** | `src/**/*.ts`, `src/**/*.tsx` | Linguagem principal para autenticação/sessão (`src/auth/authStorage.ts`), astronauta 3D (`Astronaut3D.tsx`), lógica geográfica, controle de câmera, mixer de camadas, acessibilidade e testes tipados. |
| **GLSL (OpenGL Shading Language)** | `src/components/EarthCanvas.tsx` | Shaders de vértice e fragmento na GPU (WebGL): morfismo 3D ↔ 2D, filtragem **bicúbica B-spline + nitidez adaptativa CAS** (`HD GPU`), composição de até 5 vídeos simultâneos com 6 métodos de mesclagem e máscara territorial `4096×2048`. |
| **HTML5 (`index.html` + JSX semântico)** | `index.html`, `src/**/*.tsx` | Estrutura semântica com landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`), rótulos acessíveis nos formulários, link de salto (*skip link*), `<video>` H.264 e regiões `aria-live="polite"` para leitores de tela. |
| **CSS3 + Tailwind CSS v4 (`@tailwindcss/vite`)** | `src/index.css` | Estilização híbrida Tailwind v4 (telas de Login, Cadastro e Onboarding com `@import "tailwindcss" source("../src")`) + layout flex `.hud-chrome`, tema **Alto Contraste WCAG AAA** (`#000000` / `#ffffff` / `#facc15`), foco visível e tipografia **Space Grotesk** + **Plus Jakarta Sans**. |
| **JSON / TopoJSON / GeoJSON** | `node_modules/world-atlas/countries-10m.json` | Representação vetorial offline em alta definição (`10m`, `3,5 MB`) de fronteiras, litorais e cálculo de vizinhança terrestre. |

---

## 2. APIs Nativas do Navegador (Zero Dependência Externa)

1. **WebGL (via Three.js):** Renderização acelerada por GPU da esfera 3D, plano 2D, texturas de vídeo em tempo real e linhas vetoriais.
2. **HTML5 Video & Canvas 2D (`CanvasTexture` / `getImageData`):**
   - Decodificação nativa de MP4 H.264 (`avc1`).
   - Rasterização vetorial da máscara do país selecionado (`src/geo/countryMask.ts`).
   - Amostragem em tempo real de pixels (`1×1`) sobre a posição do cursor ou centro do país para traduzir cores científicas em descrições faladas (`src/accessibility/a11yEngine.ts`).
3. **Web Speech API (`window.speechSynthesis`):** Narração por voz em Português (`pt-BR`) ao selecionar países, alternar camadas ou acionar a leitura sob demanda (`Tecla R` / botão *Ouvir resumo*).
4. **Web Audio API (`AudioContext`):** Sonificação opcional (`Tecla S`) que converte a intensidade dos dados atmosféricos amostrados em frequência sonora (`220 Hz` a `740 Hz`).
5. **WAI-ARIA (`aria-live`, `aria-pressed`, `role="application"`):** Integração completa com leitores de tela (VoiceOver, NVDA, JAWS) e navegação 100% por teclado.

---

## 3. Bibliotecas e Ferramentas de Build/Testes

- **React 18 (`react`, `react-dom`):** Roteamento de estado (`Login / Cadastro` -> `IntroOnboarding` -> `EarthExplorerView`), player multi-track, mixer de camadas e card de logística.
- **Three.js (`three`, `@types/three`):** Globo 3D / Mapa 2D com `camera.setViewOffset`, filtro bicúbico/CAS em GLSL, **Astronauta 3D interativo** (`Astronaut3D.tsx`) e `StarfieldBackground`.
- **Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`) + Fontes `Space Grotesk` / `Plus Jakarta Sans`:** Sistema de design unificado com `AuthLayout`, páginas de entrada e HUD acessível com alto contraste WCAG AAA.
- **TopoJSON Client (`topojson-client`) + `world-atlas` (`countries-10m.json`):** Conversão de TopoJSON para GeoJSON (`feature`) em alta resolução e cálculo exato de fronteiras vizinhas (`neighbors`).
- **Lucide React (`lucide-react`):** Iconografia vetorial acessível com `aria-hidden` / rótulos explícitos nos botões.
- **Vite (`vite`, `@vitejs/plugin-react`):** Servidor de desenvolvimento rápido e empacotador de produção.
- **Vitest (`vitest`):** Suíte de testes unitários para projeção geográfica, busca/vizinhança `10m`, máscara antimeridiano, logística, autenticação/sessão e leitura acessível.
- **Skills de UI/UX Instaladas em `.agents/skills/`:** `ui-ux-pro-max` (`nextlevelbuilder/ui-ux-pro-max-skill`) e `frontend-design` (`anthropics/skills`), aplicadas para contraste, hierarquia tipográfica, `ResizeObserver`, prevenção de vazamento de VRAM no Three.js, `prefers-reduced-motion` e acessibilidade de formulários.
