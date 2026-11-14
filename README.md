# EARTHSONG · NASA SVS Earth Video Explorer

Portal web acessível estilo Google Earth (Globo 3D + Mapa 2D plano) unificado com a base **EARTHSONG (`NSA-Carranqueiros`)**, **projetado com foco em acessibilidade para pessoas com deficiência visual (baixa visão e cegueira)**, para explorar e misturar cinco visualizações científicas globais da NASA SVS:

- **SVS 5011** — *Lightning Events Detected from the ISS (2017–2023)* (`4096×2048` Science on a Sphere equiretangular)
- **SVS 5147** — *GEOS-FP Near-Surface Temperature* (`2048×1024` equiretangular + escala oficial)
- **SVS 5148** — *GEOS-FP Near-Surface Wind Speed* (`2048×1024` equiretangular + escala oficial)
- **SVS 5153** — *Carbon Monoxide (CO) — GEOS-CF* (`2048×1024` equiretangular + escala oficial)
- **SVS 5154** — *Nitrogen Oxides (NOx) — GEOS-CF* (`2048×1024` equiretangular + escala oficial)

## Fluxo da Aplicação

1. **Autenticação (`AuthLayout`, `LoginPage`, `RegisterPage`):** Acesso com credenciais padrão (`admin` / `12345`), cadastro local (`localStorage`) ou botão **Entrar como Visitante (Demonstração)**, banner oficial `public/banner.png`, céu estrelado animado e controles de acessibilidade já na entrada.
2. **Onboarding Orbital (`IntroOnboarding` + `Astronaut3D`):** Apresentação interativa em 4 passos guiada pelo Astronauta 3D com voz em PT-BR e atalho direto para o mapa (`Esc`).
3. **Tela Principal — Explorador Globo/Mapa (`EarthExplorerView`):** Globo 3D + Mapa 2D com **Copiloto Guia Orbital 3D**, mixer de 5 camadas, máscara por país, card regional/logístico e nitidez HD por GPU.

## Recursos Principais

- **Nitidez HD em Tempo Real (`HD GPU`, tecla `H`):** Filtro bicúbico B-spline + *Contrast-Adaptive Sharpening* (CAS) na GPU, fronteiras vetoriais de alta definição (`world-atlas/countries-10m.json`), malha `192×96` e máscara territorial `4096×2048`.
- **Acessibilidade para Deficientes Visuais (Baixa Visão e Cegueira):**
  - **Narração por Voz em PT-BR (`Web Speech API`, tecla `V`):** anuncia países selecionados, região, logística e leituras atmosféricas das camadas ativas; leitura sob demanda com a tecla `R` ou botão **Ouvir resumo em áudio**.
  - **Sonificação (`Web Audio API`, tecla `S`):** converte a intensidade dos dados atmosféricos sob o cursor em frequência sonora (`220 Hz`–`740 Hz`).
  - **Navegação 100% por Teclado & Leitores de Tela (`WAI-ARIA`):** setas direcionais para mover, `+`/`-` para zoom, `Espaço` para Play/Pause, `Esc` para fechar destaque, *skip link* e região `aria-live="polite"`.
  - **Alto Contraste WCAG AAA (tecla `C`) & Escala de Fonte (`A+100%`–`A+130%`):** tema preto/branco/amarelo de alto contraste e ampliação automática dos rótulos no mapa.
- **Destaque por Máscara + Enquadramento à Esquerda + Card de Logística:**
  - Ao selecionar um país, uma máscara `4096×2048` gerada na GPU escurece o resto do mundo (~76%) mantendo o país 100% iluminado e deslocado para a esquerda, exibindo à direita um card com **local, região, fronteiras vizinhas, portos, corredores aéreos/terrestres e impacto climático-logístico**.
- **Mixer de 5 Vídeos Simultâneos e Modos de Mesclagem:**
  - Ligue de 1 a 5 camadas ao mesmo tempo, reordene a pilha e ajuste individualmente opacidade e método de mesclagem (**Normal**, **Screen**, **Add/Soma**, **Multiply**, **Overlay**, **Difference**).

## Como Executar Localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173/` no navegador.

### Testes e Build

```bash
npm test       # Executa os testes unitários (Vitest)
npm run build  # Verifica TypeScript e gera o bundle de produção
```

## Documentação Técnica

- [DIARIO_TECNICO_E_TESTES.md](file:///Users/samuelamorim/Documents/projeto%20nasa/docs/DIARIO_TECNICO_E_TESTES.md) — Decisões arquiteturais, problemas corrigidos, testes unitários e validação E2E no Chrome.
- [LINGUAGENS_E_TECNOLOGIAS.md](file:///Users/samuelamorim/Documents/projeto%20nasa/docs/LINGUAGENS_E_TECNOLOGIAS.md) — Inventário completo de linguagens, shaders GLSL, APIs nativas (WebGL, Web Speech, Web Audio, ARIA) e bibliotecas utilizadas.
