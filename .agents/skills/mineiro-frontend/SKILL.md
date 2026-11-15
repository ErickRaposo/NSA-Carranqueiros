---
name: mineiro-frontend
description: Design System canônico e engenharia de interface do MINEIRØ / EARTHSONG (Site Institucional, Autenticação, Globo 3D/2D, Mapa NASA e HUD de Instrumentos Orbitais). Ative sempre que for criar novas telas, novos modais/fluxos, ajustar estilos, botões, fontes, cores, degradês ou validar consistência visual no projeto.
---

# MINEIRØ Frontend & Design System — Protocolo da Equipe

Sempre que esta skill ou o subagente `mineiro-frontend` for acionado para desenvolver ou refatorar qualquer tela do **MINEIRØ / EARTHSONG**, siga esta ordem:

1. **Fonte Única da Verdade:** leia [`DESIGN.md`](../../../DESIGN.md) e [`.impeccable/design.json`](../../../.impeccable/design.json) na raiz do projeto, além das instruções completas do agente em [`.agents/agents/mineiro-frontend.md`](../../agents/mineiro-frontend.md).
2. **Separação Clara de Superfícies:**
   - **Site Institucional & Auth (`EntryPortal`, `AuthLayout`, `Login/Register`):** espaço `#02050d`, split gradient `#030816 -> #07142e -> #040b1c`, faixa editorial clara `#f8fafc`/`#0a1a35`, títulos monumentais em `Orbitron` uppercase, corpo/UI em `Poppins`, CTAs pílula `#ffffff` e azul orbital `#1d4ed8` (ou submit `#1a3a7a` nos formulários de conta).
   - **Explorador Planetário (`EarthExplorerView`, Globo 3D/2D, Mapa & HUD):** protagonismo de ~90% para o planeta (`#060913`), cápsulas flutuantes `999px` em ardósia-obsidiana `rgba(6, 12, 26, 0.78)` (`blur(16px)`), gavetas `18px` em `rgba(8, 13, 25, 0.95)` (`blur(20px)`), bordas hairline `rgba(148, 163, 184, 0.16)`, `Poppins` com `tabular-nums` e **cores saturadas exclusivas para os 5 stems científicos da NASA** (`#fbbf24`, `#fb923c`, `#fb7185`, `#34d399`, `#38bdf8`).
3. **Evolução Passo a Passo:** nunca introduza cores, fontes, sombras neon ou cards gamificados paralelos. Se uma nova tela pedir mudança de logística ou evolução de um token/componente, proponha a mudança claramente, alinhe passo a passo com o usuário (e com `mineiro-cpo` em decisões de produto) e mantenha `DESIGN.md` + `src/index.css` sincronizados.
4. **Piso Estrutural de Qualidade:** garanta suporte a `.high-contrast` (WCAG AAA), `fontScale` (`1` / `1.15` / `1.3`), `prefers-reduced-motion`, `:focus-visible` (`#7dd3fc`) e validação via `npm test && npm run build`.
