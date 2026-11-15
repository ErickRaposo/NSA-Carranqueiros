# Documentação das Vozes Neurais (Piper TTS & Web Speech Fallback) — MINEIRØ

Este documento registra as vozes sintetizadas e humanizadas utilizadas pelo astronauta **MINEIRØ** na experiência imersiva em **Inglês (`en-US`)** e **Português Brasileiro (`pt-BR`)**.

---

## 1. Motor de Síntese no Navegador

- **Biblioteca:** `@mintplex-labs/piper-tts-web` (execução local de modelos ONNX/VITS no navegador via WebAssembly + `onnxruntime-web`).
- **Armazenamento em Cache:**
  - Os modelos `.onnx` e `.onnx.json` são pré-carregados em segundo plano via `preloadPiperVoice(lang)` e salvos no **OPFS** (*Origin Private File System*) do navegador.
  - Os áudios `.wav` já sintetizados para cada frase ficam em cache em memória (`Map<string, string>` com `URL.createObjectURL`) para reprodução instantânea.
- **Fallback Automático:** Caso o navegador esteja offline sem modelo em cache ou sem suporte a OPFS/WASM, `src/accessibility/a11yEngine.ts` alterna automaticamente para a **Web Speech API** (`window.speechSynthesis`), priorizando vozes masculinas no idioma correspondente.

---

## 2. Voz em Inglês (`en-US`)

- **Identificador do Modelo:** `en_US-bryce-medium`
- **Idioma / Região:** `en_US` (Inglês — Estados Unidos)
- **Perfil:** Voz masculina neural de qualidade `medium` (VITS / Piper)
- **Repositório Hugging Face:**  
  https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/bryce/medium
- **Amostra Oficial (Piper Samples):**  
  https://rhasspy.github.io/piper-samples/#en_US-bryce-medium
- **Arquivos do Modelo:**
  - `en/en_US/bryce/medium/en_US-bryce-medium.onnx`
  - `en/en_US/bryce/medium/en_US-bryce-medium.onnx.json`

---

## 3. Voz em Português Brasileiro (`pt-BR`)

- **Identificador do Modelo:** `pt_BR-faber-medium`
- **Idioma / Região:** `pt_BR` (Português — Brasil)
- **Perfil:** Voz masculina neural de qualidade `medium` (VITS / Piper)
- **Repositório Hugging Face:**  
  https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR/faber/medium
- **Amostra Oficial (Piper Samples):**  
  https://rhasspy.github.io/piper-samples/#pt_BR-faber-medium
- **Arquivos do Modelo:**
  - `pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx`
  - `pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json`
- **Fallback Web Speech (`pt-BR`):** Prioriza vozes nativas masculinas do sistema/navegador (ex.: *Daniel*, *Antonio*, *Ricardo*, *Felipe*, *Hélio*) com `pitch = 0.85` e `lang = 'pt-BR'`.

---

## 4. Integração de Áudio na Sala Sensorial

- **`src/accessibility/a11yEngine.ts`**: Define `PIPER_VOICE_IDS`, `preloadPiperVoice(lang)`, `speakText(text, lang, interrupt, options)`, `speakTextPt(...)` e `stopSpeech()`.
- **`src/scenes/RightWallScene.tsx`**: Pré-carrega a voz do idioma ativo e dispara as falas do **MINEIRØ** sem cortar frases em andamento.
- **`src/audio/spaceAmbient.ts`**: Controla o *ducking* automático da trilha espacial (`setSpaceAmbientDucked(true)` enquanto a voz está ativa e `setSpaceAmbientDucked(false)` ao finalizar).
