# Referências, Fontes Científicas e Licenças — MINEIRØ / Earth Jukebox

Este documento reúne todas as fontes de dados científicos, conjuntos cartográficos, vozes, mídias e bibliotecas open-source utilizadas no projeto **Earth Jukebox / MINEIRØ** (*NASA Space Apps Challenge — The Earth Information Jukebox*), para fins de auditoria acadêmica, créditos na submissão e conformidade de licença.

---

## 1. Dados Científicos — NASA Scientific Visualization Studio (SVS)

As cinco camadas audiovisuais do instrumento planetário são baseadas em visualizações oficiais públicas da NASA:

| Camada no Sistema | Dataset / Sensor NASA | Identificador SVS | Crédito Científico |
| --- | --- | --- | --- |
| **Melodia (`melody`)** | ISS LIS Lightning Events (`2017–2023`) | NASA SVS `5011` | NASA's Scientific Visualization Studio / Richard J. Blakeslee (GHRC DAAC) |
| **Temperatura (`temperature`)** | GEOS-FP Near-Surface Air Temperature (`T2M`) | NASA SVS `5147` | NASA Global Modeling and Assimilation Office (GMAO) / SVS |
| **Ventos (`wind`)** | GEOS-FP Near-Surface Wind Speed (`10m`) | NASA SVS `5148` | NASA Global Modeling and Assimilation Office (GMAO) / SVS |
| **Acordes (`chords`)** | Carbon Monoxide (`CO`) — GEOS-CF | NASA SVS `5153` | NASA Global Modeling and Assimilation Office (GMAO) / SVS |
| **Baixo (`bass`)** | Nitrogen Oxides (`NOx`) — GEOS-CF | NASA SVS `5154` | NASA Global Modeling and Assimilation Office (GMAO) / SVS |

Referência adicional de sonificação por país: base conceitual `ErickRaposo/nasa-geo-sonification` (pacote offline em `public/countries/`).

---

## 2. Cartografia, Bandeiras e Mídias Offline

| Recurso | Versão / Origem | Licença | Atribuição / Nota de Uso |
| --- | --- | --- | --- |
| **`flag-icons`** | `v7.6.0` (`lipis/flag-icons`) | **MIT License** | *Copyright (c) 2013 Panayiotis Lipiridis* (`node_modules/flag-icons/LICENSE`). Fornece bandeiras vetoriais SVG 100% offline (`1x1` e `4x3`) para o mosaico do Teto (`CeilingScene.tsx`) e badges/seletores (`CountryFlag.tsx`), sem dependência de CDN externa. |
| **`world-atlas` (`countries-10m.json`)** | `v2.0.2` (derivado de *Natural Earth 1:10m*) | **ISC / Public Domain (Natural Earth)** | Fronteiras nacionais, litorais e topologia vetorial offline para o globo 3D/2D e geração de máscaras por país. |
| **`topojson-client`** | `v3.1.0` | **ISC License** | Conversão TopoJSON → GeoJSON e cálculo de vizinhos terrestres em memória. |
| **Curiosidades Culturais / Fotos** | Wikimedia Commons / Wikipedia (`src/geo/countryCultureCard.ts`) | **Domínio Público / CC BY-SA** | Imagens com atribuição explícita por país armazenada nos metadados do card no Teto. |

---

## 3. Bibliotecas de Interface, 3D, Áudio e Acessibilidade

| Pacote | Versão (`package.json`) | Licença | Papel no Sistema |
| --- | --- | --- | --- |
| **`react` / `react-dom`** | `^18.3.1` | **MIT** | Interface do Controle Tablet, Painel Técnico, Simulador 3D e Projetores. |
| **`three`** | `^0.170.0` | **MIT** | Renderização WebGL do Globo 3D / Mapa 2D (`EarthCanvas.tsx`). |
| **`motion`** | `^14.14.0` | **MIT** | Coreografias de entrada, transições das cenas projetadas e flutuadores do Teto. |
| **`lucide-react`** | `^0.460.0` | **ISC** | Iconografia vetorial técnica da UI. |
| **`@mintplex-labs/piper-tts-web`** | `^1.0.5` | **MIT** | Síntese neural de voz offline (VITS/ONNX) em PT-BR e EN para narração do Robô MINEIRØ e acessibilidade. |
| **`tailwindcss` / `@tailwindcss/vite`** | `^4.x` | **MIT** | Design tokens e estilização utilitária. |

---

## 4. Texto Pronto de Crédito / Atribuição

Caso precise copiar para a página do projeto no NASA Space Apps, apresentação em PDF ou tela pública:

> **Fontes Científicas e Recursos Open-Source:** Visualizações globais da Terra por **NASA Scientific Visualization Studio (SVS 5011, 5147, 5148, 5153, 5154)** e GMAO. Geometria territorial offline por **Natural Earth / world-atlas** (`topojson-client`). Bandeiras nacionais vetoriais offline por **flag-icons** (`github.com/lipis/flag-icons`, licença MIT, Copyright © 2013 Panayiotis Lipiridis). Síntese de voz neural local via **Piper TTS (`@mintplex-labs/piper-tts-web`)**.
