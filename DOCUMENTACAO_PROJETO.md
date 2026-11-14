# Documentação Técnica e Relatório Final — Projeto NASA Space Apps 2026

> **Desafio Oficial:** *The Earth Information Jukebox* (NASA Earth Information Center — EIC)  
> **Última atualização:** 14/11/2026  

---

## 1. Visão Geral do Sistema
O projeto tem como objetivo transformar dados e visualizações científicas da NASA (originalmente visuais) em uma experiência **multissensorial, interativa e acessível**, conectando exploração geográfica, sonificação musical e audiodescrição contextual para inclusão de pessoas cegas ou com baixa visão.

### Credenciais de Teste (MVP)
* **Usuário:** `admin` (ou `admin@earthsong.space`)
* **Senha:** `12345`
* *(Também é possível criar novas contas na tela de Cadastro e entrar imediatamente).*

---

## 2. Inventário Completo de Bibliotecas e Ferramentas

Todas as dependências listadas abaixo correspondem exatamente ao arquivo `package.json` atual do projeto:

### Dependências de Produção (`dependencies`)
| Biblioteca | Versão | Finalidade no Projeto |
| :--- | :--- | :--- |
| **`react`** | `^19.3.1` | Biblioteca principal para construção da interface em componentes reativos e gerenciamento de estado (login, cadastro, navegação). |
| **`react-dom`** | `^19.3.1` | Renderização da árvore de componentes React no DOM do navegador. |
| **`lucide-react`** | `^1.73.0` | Pacote de ícones vetoriais SVG leves e acessíveis (ícones de exibir/ocultar senha, upload de banner, áudio, logout). |
| **`three`** | `^0.187.0` | Motor 3D WebGL usado para renderizar e animar o astronauta 3D interativo da introdução (respiração, piscar de olhos, gestos de braço e gravidade zero). |

### Dependências de Desenvolvimento e Build (`devDependencies`)
| Biblioteca | Versão | Finalidade no Projeto |
| :--- | :--- | :--- |
| **`vite`** | `^8.3.6` | Bundler e servidor de desenvolvimento ultrarrápido com Hot Module Replacement (HMR). |
| **`@vitejs/plugin-react`** | `^6.1.2` | Plugin oficial do Vite para suporte a JSX, Fast Refresh e otimização do React. |
| **`typescript`** | `~7.0.2` | Superset tipado de JavaScript para segurança de tipos estática e manutenibilidade do código. |
| **`tailwindcss`** | `^4.3.5` | Framework CSS utility-first utilizado para estilização responsiva, layout split-screen e tema dark navy. |
| **`@tailwindcss/vite`** | `^4.3.5` | Integração nativa do Tailwind CSS v4 no pipeline do Vite. |
| **`@types/react`** | `^19.3.0` | Definições de tipos TypeScript para o React 19. |
| **`@types/react-dom`** | `^19.3.0` | Definições de tipos TypeScript para o React DOM 19. |
| **`@types/three`** | `^0.187.0` | Definições de tipos TypeScript para o motor 3D Three.js. |
| **`@types/node`** | `^24.19.2` | Definições de tipos TypeScript para APIs do ambiente Node.js usadas na configuração do Vite. |
| **`oxlint`** | `^1.90.0` | Linter de alta performance para análise estática de código JavaScript/TypeScript. |

### Recursos Externos (Tipografia)
* **Google Fonts — `Space Grotesk` (`500`, `600`, `700`):** Fonte geométrica moderna utilizada em títulos e cabeçalhos (`font-display`), remetendo à estética aeroespacial e científica.
* **Google Fonts — `Plus Jakarta Sans` (`400`, `500`, `600`, `700`):** Fonte sans-serif limpa utilizada em formulários, botões e textos corridos para máxima legibilidade.

---

## 3. Arquitetura de Arquivos Atual

```text
c:\apps\nasaspaceapps\
├── index.html                           # Ponto de entrada HTML + carregamento das fontes Google
├── package.json                         # Manifesto de dependências e scripts
├── vite.config.ts                       # Configuração do Vite + React + Tailwind v4
├── DOCUMENTACAO_PROJETO.md              # Este documento (referência para o relatório final)
└── src/
    ├── index.css                        # Configuração do Tailwind v4 e tokens de fonte/cores
    ├── main.tsx                         # Inicialização do React no #root
    ├── App.tsx                          # Roteamento de estado (Login / Cadastro / Dashboard) e autenticação
    ├── components/
    │   ├── Astronaut3D.tsx              # Astronauta moderno 3D em Three.js (respiração, piscar, gestos)
    │   ├── AuthLayout.tsx               # Layout 50/50 dark navy com espaço para banner quadrado (1:1)
    │   ├── IntroOnboarding.tsx          # Apresentação inicial guiada pelo astronauta com áudio PT-BR
    │   └── StarfieldBackground.tsx      # Céu estrelado animado em Canvas HTML5 (movimento espacial sutil)
    └── pages/
        ├── LoginPage.tsx                # Tela de Login (validação admin/12345 + show/hide senha)
        └── RegisterPage.tsx             # Tela de Cadastro com validação completa de campos e senha
```

---

## 4. Decisões de Design, UX e Acessibilidade (Para o Relatório Final)

### Identidade Visual (Dark Mode Azul Marinho sem Neon)
* **Paleta escolhida:** Tons sóbrios de azul escuro profundo e azul marinho (`#030816`, `#040A18`, `#07142E`, `#0B1936`, `#163675`), evitando cores neon para reduzir fadiga visual e manter estética científica/institucional alinhada à NASA.
* **Fundo Espacial Animado (`StarfieldBackground`):** Campo estelar em `<canvas>` com estrelas em múltiplas camadas de profundidade se movendo suavemente. Respeita automaticamente a preferência do sistema operacional `prefers-reduced-motion` (pausa o movimento para usuários com sensibilidade vestibular).
* **Banner Quadrado (`1:1`):** Área reservada na metade esquerda da tela (`aspect-square`, até `460×460px`), com suporte automático a `public/banner.png` e pré-visualização local imediata.

### Acessibilidade e Inclusão (Pilar Central do Desafio NASA EIC)
* Rótulos semânticos (`<label className="sr-only">` associados por `htmlFor`), mensagens de erro com `role="alert"` e mensagens de status com `role="status"`.
* Botões de exibir/ocultar senha com `aria-label` dinâmico.
* Contraste adequado entre texto claro (`#E2E8F0`) e superfícies azul marinho (`#061024` / `#0B1936`).

---

## 5. Fontes de Dados Oficiais NASA Avaliadas para o Projeto
* **Earth Information Center (EIC) Content Database:** https://svs.gsfc.nasa.gov/gallery/earth-information-center/
* **SVS #5153 — Carbon Monoxide (GEOS-CF):** https://svs.gsfc.nasa.gov/5153/ (frames globais em projeção equiretangular `2048×1024`)
* **SVS #4950 — GEDI Forest Height:** https://svs.gsfc.nasa.gov/4950/
* **SVS #5425 — Perpetual Ocean 2:** https://svs.gsfc.nasa.gov/5425/
* **SVS #5011 — Lightning Events (ISS):** https://svs.gsfc.nasa.gov/5011/
* **SVS #5313 — Change in Night Lights:** https://svs.gsfc.nasa.gov/5313/
* **SVS #5669 — GEOS Aerosols:** https://svs.gsfc.nasa.gov/5669/
* **Referência de Sonificação NASA (Caldwell 73):** https://svs.gsfc.nasa.gov/13786/

---

## 6. Próximos Módulos Planejados (Checklist do Relatório)
- [x] Tela de Login e Cadastro em Dark Mode Azul Marinho com céu espacial animado
- [x] Introdução animada com Astronauta 3D (Three.js) e narração em áudio PT-BR
- [x] Espaço dedicado ao Banner Quadrado (`1:1`)
- [x] Sistema de autenticação local (`admin` / `12345` + novos cadastros)
- [ ] Dashboard principal do sistema
- [ ] Módulo de mapa interativo / datasets NASA EIC + sonificação + audiodescrição
