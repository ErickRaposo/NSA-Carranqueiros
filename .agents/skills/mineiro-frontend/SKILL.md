---
name: mineiro-frontend
description: Design System canônico (3 Mundos: Tablet/Demo Ardósia-Obsidiana, Projeção #000000 em 2 Paredes + Teto e Setup) e engenharia de interface do Earth Jukebox. Ative sempre que for criar ou refatorar telas, cenas projetadas, mixer estilo Photoshop ou Globo 3D/2D.
---

# Earth Jukebox Frontend & Design System — Protocolo da Equipe

Sempre que esta skill ou o subagente `mineiro-frontend` for acionado, leia [`.agents/agents/mineiro-frontend.md`](../../agents/mineiro-frontend.md), [`DESIGN.md`](../../../DESIGN.md) e [`.agents/skills/earth-jukebox-room/SKILL.md`](../earth-jukebox-room/SKILL.md).

## Regras Rápidas
1. **Zero legado:** sem login/auth, sem XP/missões/ranking, sem mascotes e sem `Orbitron`. `Poppins` + `tabular-nums` em 100% da aplicação.
2. **3 Mundos:**
   - **Tablet (`?view=controller`) & Demo (`?view=demo`):** Ardósia-Obsidiana (`#060913` / `#080d19`), alvos de toque `>= 44px`, `touch-action: none` nos sliders/globo.
   - **Paredes e Teto (`LeftWallScene`, `RightWallScene`, `CeilingScene`):** fundo `#000000` absoluto para zero vazamento óptico do projetor.
   - **Setup (`?view=setup`):** bancada técnica limpa em `#080d19` com métricas `tabular-nums`.
3. **5 Camadas 1:1:** `melody` (`#fbbf24` + sub-toggle `Tempestade`), `chords` (`#fb923c`), `temperature` (`#fb7185` regente `region/base`), `bass` (`#34d399`), `wind` (`#38bdf8` Dry/Wet 8D).
