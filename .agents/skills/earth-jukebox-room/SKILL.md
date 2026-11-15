---
name: earth-jukebox-room
description: >-
  Contexto completo da nova arquitetura do projeto Earth Jukebox (Quarto Projetado em Canto:
  2 paredes + teto, controle por Tablet, 3 caixas de som com áudio 8D e calibração por Ruído Rosa,
  camadas estilo Photoshop baseadas em ErickRaposo/nasa-geo-sonification, pré-geração de todos os
  países + 5 PNGs por país, modo híbrido LAN + Web/Vercel, tradução PT/EN e divisão de tarefas
  entre Pessoa 1 e Pessoa 2 no Hackathon). Ative sempre que for planejar, codificar, revisar ou
  tomar decisões técnicas/visuais sobre este projeto.
---

# Earth Jukebox — Quarto Projetado (Contexto Completo do Projeto)

Esta skill concentra **todas as decisões arquiteturais, especificações técnicas, regras visuais, contratos de código e divisão de tarefas** da nova versão do projeto **Earth Jukebox** (repositório `NSA-Carranqueiros` + pipeline `ErickRaposo/nasa-geo-sonification`).

---

## 1. Visão Geral & Mudança de Escopo

O projeto deixa de ser um jogo web individual e passa a ser uma **instalação audiovisual imersiva e científica em um canto projetado (2 paredes + teto)**, com **modo híbrido de demonstração online pública (Vercel)**.

### O que NÃO existe mais (Remover)
* **Zero gamificação, zero missões, zero ranking, zero desbloqueio de países.**
* **Zero login, cadastro, recuperação de senha ou perfis de usuário.**
* **Zero mascotes/guias antigos** (astronauta, robô, mineiro 3D).
* **Zero sintetizador musical antigo no navegador** (o antigo `soundscapeEngine.ts` é descartado; a música vem 100% pré-renderizada do pipeline Python `ErickRaposo/nasa-geo-sonification`).

### O que É Reaproveitado do Repositório Atual
* **Globo 3D e Mapa 2D morphável:** `src/components/EarthCanvas.tsx` e `src/geo/projection.ts`.
* **Geografia, polígonos, máscaras e nomes:** `src/geo/countries.ts`, `src/geo/countryMask.ts` e `src/geo/ptCountryNames.ts`.
* **Metadados científicos e escalas dos 5 datasets da NASA:** `src/datasets/nasaDatasets.ts` (expandidos para **PT-BR e EN**).

### Arquivos/Pastas a Remover na Limpeza Inicial
* `src/auth/`
* `src/game/` (`progressionStore.ts`)
* `src/community/` (`unlockStore.ts`)
* `src/audio/soundscapeEngine.ts`
* `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`
* `src/components/EntryPortal.tsx`, `src/components/AuthLayout.tsx`, `src/components/RankingPopover.tsx`, `src/components/AstronautCopilot.tsx`, `src/components/Astronaut3D.tsx`, `src/components/InAppRobotGuide.tsx`, `src/components/Mineiro3D.tsx`, `src/components/IntroOnboarding.tsx`, `src/components/PlayerHUD.tsx`, `src/components/JukeboxPanel.tsx` (substituído pelo novo mixer estilo Photoshop).
* `src/geo/unlockMapTexture.ts`

---

## 2. Topologia Física, Hardware & Modos de Execução

### Hardware da Instalação Física (Sala do Hackathon)
* **Superfícies de projeção:** 1 canto formado por **Parede Esquerda (`leftWall`) + Parede Direita (`rightWall`) + Teto (`ceiling`)**.
* **Computadores (1 a 3 PCs):** funcionam como servidores de imagem para os projetores e executam a calibração de perspectiva. Idealmente **2+ PCs** para maior resolução/qualidade das projeções, mas deve funcionar perfeitamente com **1 PC só** (inclusive para desenvolvimento local).
* **Controle:** **1 Tablet** (ou dispositivo móvel) funcionando como controle tátil da experiência para o visitante.
* **Áudio:** **3 caixas de som independentes** (Bluetooth, USB, P2 ou HDMI — mesmo de marcas e potências diferentes), com suporte alternativo para **Sistema 5.1** ou **Fone de Ouvido (Áudio 8D Binaural HRTF)**.

### Modo Híbrido de Rede e Deploy
1. **LAN Local Offline-First (Sala):** 1 PC Mestre roda o servidor local (Node + WebSocket) na rede Wi-Fi/roteador sem depender de internet. Exibe **QR Code** na tela de Setup para o Tablet e os demais PCs entrarem.
2. **Dev 1-PC:** sincronização automática entre abas do mesmo navegador via `BroadcastChannel`.
3. **Demo Web Pública (Vercel):** link público onde jurados/visitantes abrem no PC ou celular, veem o **Simulador 3D do Quarto** integrado ao controle estilo Tablet e escutam em **Áudio 8D Binaural** no fone de ouvido.

### Roteamento por Papel de Tela (`?view=`)
* `?view=setup` — Configuração de proporção das paredes, posição/calibração das caixas de som (Ruído Rosa + delay ms), links dos projetores e QR Code do Tablet.
* `?view=simulator` — Maquete 3D interativa do canto (2 paredes a 90° + teto) + visão planificada das 3 telas lado a lado para o Designer trabalhar no monitor local.
* `?view=projector&out=1` (ou `2`, `3`) — Saída fullscreen limpa para projetor(es), com motor de homografia Corner-Pin.
* `?view=controller` — Interface do Tablet para o visitante.
* `?view=demo` — Experiência unificada responsiva para o deploy público na Vercel.

---

## 3. Base Musical & Imagens Pré-Geradas (`nasa-geo-sonification`)

Toda a sonificação segue a arquitetura determinística de `ErickRaposo/nasa-geo-sonification` (referência: `jukebox_studio.py` e `nasa_soundscape/config.py`), porém **pré-gerada offline em lote para todos os ~177 países** do `world-atlas` usando o polígono de cada país como máscara geográfica.

### Papéis das 5 Camadas (Estilo "Olhinho" do Photoshop)
1. **`melody` — Melodia (Raios ISS · SVS 5011):**
   * Timbre Celesta/Rhodes + pentatônica suspensa neutra.
   * Subcamada **`sparkle` (Tempestade: 5ª/8ª + Brilho):** ativa dobras e cintilação cristalina aguda quando há alta densidade de raios.
   * Cada nota possui coordenadas normalizadas `(source_x, source_y)`, `start_beat`, `duration_beats`, `pitch` e `is_anchor`.
2. **`chords` — Acordes (Monóxido de Carbono CO · SVS 5153):**
   * *Pad Unison* de 3 a 5 vozes; nível de CO define modo (Lídio → Frígio) e `harmony_plan` (1 acorde por compasso).
3. **`bass` — Baixo (Óxidos de Nitrogênio NO₂ · SVS 5154):**
   * Sub-bass contínuo com *cutoff* (`120–560 Hz`) e *drive* (`0.04–0.48`). Pode seguir as fundamentais do `harmony_plan` mesmo quando o olhinho de CO está desligado.
4. **`temperature` — Regente: Temperatura (T2M · SVS 5147):**
   * **Não possui áudio nem stem próprio.**
   * Olhinho **Ligado (`region`)**: o clima do país define Tom e BPM (`66–110 BPM`).
   * Olhinho **Desligado (`base`)**: usa constantes neutras (`Lá / A`, `90 BPM`).
5. **`wind` — Bus de Efeito: Vento (10m Wind · SVS 5148):**
   * **Não gera notas próprias.**
   * Aplica espacialização linear (Chorus + Ping-Pong Delay + Filtro + Hall/Shimmer Reverb) sobre a soma dos instrumentos ligados.

### Estrutura de Arquivos Pré-Gerados por País (`countries/<iso_or_id>/`)
1. **8 Stems de Áudio por afinação (`region/` e `base/`):**
   * `chords_dry`, `chords_wind`
   * `bass_dry`, `bass_wind`
   * `melody_main_dry`, `melody_main_wind`
   * `melody_sparkle_dry`, `melody_sparkle_wind`
   * **Formato:** Comprimidos em **OGG/Opus ou M4A (~128 kbps)** para reduzir o pacote global de ~7,8 GB (WAV) para ~450 MB, mantendo loop **100% gapless** após decodificação em `AudioBuffer` via Web Audio API.
2. **`meta.json`:**
   * `session` (`region` e `base`: `bpm`, `key_root`, `key_root_pt`, `duration_seconds`, `total_bars`)
   * `harmony_plan` (`mode_id`, `mode_name_pt`, `chord_progression`)
   * `musical_parameters` (`wind.mean_speed`, `wind.reverb_decay_seconds`, `bass`, `melody`)
   * `tracks` (`melody`, `melody_sparkle`, `chords_pad`, `bass` — com `source_x`, `source_y`, `start_beat`, `duration_beats`, `pitch`, `is_anchor`)
   * `yellow_counts` por frame e `persistent_peaks`.
3. **5 PNGs Recortados na Silhueta do País:**
   * `melody.png`, `chords.png`, `temperature.png`, `bass.png`, `wind.png`
   * Fundo **100% transparente** fora da fronteira do país.
   * Estilo visual, paleta e regra de transparência interna (para empilhamento estilo Photoshop) definidos pelo **Designer (Pessoa 1)** antes do batch dos 177 países.

---

## 4. Sistema de Projeção, Perspectiva & Simulador

* **Proporção Física Configurável:** No `?view=setup`, define-se largura e altura reais (ex.: em cm/m) de `leftWall`, `rightWall` e `ceiling`.
* **Motor Flexível de Homografia (Corner-Pin 4 Pontos):**
  * Cada janela `?view=projector&out=N` pode ativar **1, 2 ou todas as 3 superfícies** na mesma tela cheia.
  * Isso atende tanto **1 único projetor apontado para o canto** (iluminando as 2 paredes + teto simultaneamente) quanto **2 ou 3 projetores dedicados** em 1 a 3 PCs.
  * Para cada superfície ativa, o operador arrasta os **4 vértices (cantos)** sobre uma grade de calibração numerada com mira central (calculando matriz projetiva `matrix3d` / homografia).
  * **Regra de ouro visual para projeção:** usar preto puro (`#000000`) nos fundos e bordas para evitar vazamento de retângulo cinza da lâmpada do projetor na parede.
* **Simulador 3D do Quarto (`?view=simulator`):**
  * Renderiza no monitor local o canto em 3D (duas paredes a 90° + teto respeitando as proporções configuradas) com câmera orbital e toggle para visualização planificada (3 retângulos lado a lado).
  * **Prioridade #1 do projeto:** deve ser o primeiro entregável funcional (com 3 países piloto) para que o Designer crie a experiência visual das paredes e do teto em tempo real.

---

## 5. Sistema de Áudio Dinâmico "8D" & Calibração das Caixas

### 3 Modos de Saída de Áudio
1. **3 Caixas Individuais (Bluetooth / USB / P2 / HDMI):**
   * Suporta **ambos** os modelos de conexão física:
     * Múltiplas saídas em 1 PC Mestre via `AudioContext.setSinkId(deviceId)`;
     * Caixas conectadas em outros PCs da sala atuando como nós receptores de áudio via WebSocket/LAN.
   * Espacialização 3D por amplitude vetorial (**VBAP**) mapeando as coordenadas físicas configuradas para as 3 caixas.
2. **Fone de Ouvido (Binaural 8D):** `PannerNode` com `panningModel = 'HRTF'` (padrão no `?view=demo` e dev local).
3. **Sistema 5.1 Surround:** saída multicanal de 6 canais (`ChannelMergerNode`).

### Espacialização Guiada pelos Dados da NASA (`meta.json`)
* **Melodia & Tempestade (Raios):** cada nota posiciona-se/viaja pelo espaço 3D usando `source_x` (Oeste→Leste) e `source_y` (Sul→Norte/Teto) reais do relâmpago.
* **Vento (Bus FX):** orbita em 360° ("8D") pela sala na velocidade proporcional a `wind.mean_speed` do país.
* **Acordes (CO):** abertura estéreo/panorâmica ampla entre Parede Esquerda e Parede Direita.
* **Baixo (NO₂):** ancorado com ganho uniforme para manter corpo grave coeso na sala.

### Calibração Manual das Caixas (`?view=setup`)
* **Posicionamento:** mapa da sala para atribuir qual dispositivo/nó físico representa cada posição (`Caixa 1`, `Caixa 2`, `Caixa 3` — ex.: Esq, Dir, Teto/Traseira).
* **Balanceamento por Ruído Rosa (Pink Noise):** botões para tocar Ruído Rosa individualmente em cada caixa + modo **Alternância A/B com Caixa Referência** + **slider de Ganho de Calibração (`0%–200%`)** por caixa para equalizar caixas de marcas/potências diferentes no ouvido.
* **Compensação de Atraso Bluetooth (`0–400 ms`):** botão de pulso rítmico ("clique seco") + slider de delay em milissegundos por caixa para alinhar caixas P2/USB mais rápidas com caixas Bluetooth que possuem latência maior.

---

## 6. Controle no Tablet & Idiomas (PT-BR / EN)

* **Interface do Tablet (`?view=controller`):**
  * **Sem login e sem mascotes.**
  * Globo 3D / Mapa 2D interativo + barra de busca de países (funcionando em PT e EN).
  * **Stack estilo Photoshop:** visualização dos 5 PNGs do país + botões de **Olhinho** (`Melodia`, `Tempestade`, `Acordes`, `Temperatura`, `Baixo`, `Vento`), botão **Solo (`S`)**, sliders de volume com medidores VU vivos e volume Master.
  * Controles de transporte: Play/Pause, barra de progresso/timeline clicável dos compassos, exibição de Tom, BPM e acorde atual.
  * **Explicação científica concisa (PT/EN)** de como os dados da NASA daquele país estão gerando a música atual.
  * **Ergonomia Touch:** alvos de toque `>= 44px`, prevenção de scroll elástico/zoom acidental ao girar o globo ou arrastar sliders.
* **Tradução PT-BR / EN:** chave global sincronizada em tempo real entre o Tablet e todas as superfícies projetadas.

---

## 7. Contrato Técnico Compartilhado (Desenvolvimento Paralelo)

Para evitar conflitos de Git entre **Pessoa 1** e **Pessoa 2**, toda comunicação entre o motor e as cenas visuais passa por um único hook `useExperience()` e componentes de cena dedicados:

* **Estado exposto por `useExperience()`:**
  * `country`: país selecionado (`id`, `iso`, `namePt`, `nameEn`, `lon`, `lat`, `bbox`)
  * `lang`: `'pt' | 'en'`
  * `layers`: estado de cada camada (`enabled`, `gain`, `solo`) + estado do regente `temperature` (`region` vs `base`)
  * `playback`: `isPlaying`, `bar`, `beat`, `progress`, `durationSeconds`, `bpm`, `keyRoot`, `activeChord`
  * `liveEvents`: notas/raios ativos no instante atual (com `source_x`, `source_y`, `pitch`, `isAnchor`) e níveis VU/bandas por camada
  * `pngUrls`: URLs dos 5 PNGs recortados do país atual
  * **Ações:** `selectCountry()`, `toggleEye()`, `setLayerGain()`, `toggleSolo()`, `togglePlay()`, `seekBeat()`, `setLang()`
* **Componentes visuais de propriedade da Pessoa 1:**
  * `LeftWallScene.tsx` (100% livre para o Designer)
  * `RightWallScene.tsx` (100% livre para o Designer)
  * `CeilingScene.tsx` (100% livre para o Designer)
  * `TabletControllerView.tsx`
  * `WebDemoOverlay.tsx`

---

## 8. Divisão Cronológica de Tarefas (Hackathon — 2 Pessoas)

### Pessoa 2 (Infra, Perspectiva, Sync, Python Batch & Áudio 8D)
1. **Limpeza & Roteamento (`?view=`):** remover módulos antigos (auth, game, community, mascotes, synth antigo) e criar rotas + cenas vazias (`LeftWallScene`, `RightWallScene`, `CeilingScene`).
2. **Store `useExperience()` + `BroadcastChannel` + 3 Países Piloto:** destravar dados reais iniciais (ex.: Brasil, Egito, China) do `nasa-geo-sonification`.
3. **Setup de Paredes, Homografia Corner-Pin & Simulador 3D (`?view=setup`, `?view=simulator`, `?view=projector`):** primeiro marco crítico para liberar a Pessoa 1.
4. **Script Batch Python (~177 países):** rodar em background gerando os 8 stems comprimidos (`region`/`base`), `meta.json` e os 5 PNGs na silhueta conforme especificação visual da Pessoa 1.
5. **Player Web Audio Gapless:** leitura de stems, crossfade `dry/wind`, troca `region/base`, timeline e `liveEvents`/VU em tempo real.
6. **Motor Áudio 8D + Calibração:** espacialização guiada por `meta.json` (3 caixas VBAP, Fone HRTF, 5.1) + tela de setup de áudio (`setSinkId` + nós remotos LAN, Ruído Rosa A/B, volume e delay `ms`).
7. **Servidor WebSocket LAN + QR Code + Deploy Assets (`VITE_ASSETS_BASE_URL`):** sincronia multi-PC/Tablet sem internet e preparação para Vercel.

### Pessoa 1 (Direção de Arte, Paredes/Teto, Tablet & Tradução PT/EN)
1. **Direção de Arte & Spec dos 5 PNGs:** definir conceito visual das 3 superfícies e especificar para a Pessoa 2 como os 5 PNGs por país devem ser gerados (cores, contornos, transparência para empilhamento).
2. **Sistema Bilíngue (`src/i18n/` PT/EN) & Limpeza do Globo:** limpar `EarthCanvas.tsx` de props antigas de jogo e traduzir UI + textos científicos de `nasaDatasets.ts` + países.
3. **Base do Tablet (`?view=controller`):** Globo 3D/Mapa 2D + busca PT/EN + troca de idioma + mixer de camadas estilo Photoshop (olhinhos, Solo, volumes, Play/Pause).
4. **Validação dos 3 Países Piloto no Simulador 3D:** aprovar/ajustar a estética dos 5 PNGs antes do batch dos 177 países.
5. **Criação das 3 Cenas (`LeftWallScene`, `RightWallScene`, `CeilingScene`):** compor livremente as 2 paredes e o teto no Simulador 3D (fundo preto `#000000`, Globo, PNGs, pulsos de raios/vento/harmonia via `useExperience()`).
6. **Finalização do Tablet:** preview dos 5 PNGs empilhados, VUs vivos, timeline clicável dos compassos, cards científicos PT/EN e ergonomia touch.
7. **Demo Web Pública (`?view=demo`) & Revisão Bilíngue:** layout responsivo para Vercel unindo Simulador 3D + controle Tablet + aviso de fone 8D.
