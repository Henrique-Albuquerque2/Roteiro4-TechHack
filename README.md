# PrivacyLens — Roteiro 3 (TechHacker)

Extensao para Firefox que detecta e exibe os principais vetores de rastreamento e violacao de privacidade observados durante a navegacao web. Desenvolvida como entrega do Roteiro 3 da disciplina TechHacker (Insper, 2026.1, Prof. Joao Eduardo).

## Visao geral

A extensao monitora, em tempo real, a aba ativa do navegador e apresenta:

- **Conexoes a dominios de terceira parte**, com tipo de recurso (script, image, iframe, xhr, font, media, websocket, etc.);
- **Cookies injetados**, classificados em 1st vs 3rd party, sessao vs persistente, alem de identificacao de supercookies (HSTS multi-subdominio, ETag persistente);
- **Web Storage (`localStorage` / `sessionStorage`) e IndexedDB**, exibindo chave, tamanho, origem e amostra;
- **Browser fingerprinting** via hooks em `HTMLCanvasElement.toDataURL`, `toBlob`, `CanvasRenderingContext2D.getImageData`, `WebGLRenderingContext.getParameter` (incluindo `UNMASKED_VENDOR_WEBGL`/`UNMASKED_RENDERER_WEBGL`), `AudioContext.createOscillator`, `createDynamicsCompressor`, `createAnalyser`, `OfflineAudioContext` e leitores de `navigator`/`screen`;
- **Cookie syncing** entre dominios — quando fragmentos de cookies definidos por A aparecem em requisicoes para B;
- **Hijacking/hooking** — heuristicas para `hook.js` (BeEF), scripts servidos por IP bruto, URLs `javascript:`/`data:`, e redirecionamentos cross-site;
- **Privacy Score** documentado, com penalidades por sinal e nota A-F.

A pontuacao da aba ativa aparece como letra (A/B/C/D/F) no badge do icone da extensao.

## Como instalar (Firefox, modo temporario)

1. Abra `about:debugging` no Firefox.
2. Clique em **Este Firefox** (lateral esquerda).
3. Clique em **Carregar extensao temporaria...**.
4. Selecione o arquivo `manifest.json` deste repositorio.
5. O icone da extensao (lupa azul) aparece na barra de ferramentas.

> A extensao usa Manifest V2 e a API `webRequest`. Para uso permanente, seria necessario assinar a extensao via AMO (nao requerido pelo roteiro).

## Como usar

1. Navegue para qualquer site (sugestoes em **Testes** abaixo).
2. Clique no icone da extensao para abrir o **popup** com pontuacao e contadores rapidos.
3. Clique em **Abrir relatorio completo** para ver o dashboard com sete abas:
   - Dominios — lista de eTLD+1 de terceira parte e tipos de recurso;
   - Cookies — cada cookie capturado em `Set-Cookie` + supercookies;
   - Storage — entradas de `localStorage`, `sessionStorage` e bancos IndexedDB;
   - Fingerprinting — chamadas a APIs sensiveis e o script chamador;
   - Cookie sync — pares de dominios `A -> B` com fragmento sincronizado;
   - Hijacking — alertas heuristicos;
   - Pontuacao — quebra detalhada das penalidades.
4. Use **Reiniciar aba** para zerar os contadores da aba sem recarregar a pagina.

A aba do dashboard se atualiza sozinha a cada ~2,5s.

## Metodologia do Privacy Score

A pontuacao comeca em **100** e cada sinal de risco subtrai pontos, com um **cap por categoria** para evitar que um unico sinal zere a nota:

| Sinal | Penalidade por ocorrencia | Cap |
|---|---:|---:|
| Dominio de terceira parte | −2 | −30 |
| Cookie de terceira parte | −3 | −20 |
| Cookie persistente de terceira parte (extra) | −2 | −16 |
| Supercookie (HSTS/ETag) | −10 | −30 |
| Superficie de fingerprinting usada (Canvas/WebGL/Audio/Navigator/Screen) | −8 | −24 |
| Aresta de cookie syncing | −5 | −15 |
| Alerta de hijacking/hooking | −20 | −40 |
| Origem com storage pesado (>50 KB) | −3 | −9 |

A nota final segue a escala: **A** ≥ 85, **B** ≥ 70, **C** ≥ 50, **D** ≥ 30, **F** abaixo disso.

### Justificativa

- O **maior peso individual** vai para hijacking porque um unico script malicioso compromete a sessao inteira; por isso a categoria sozinha pode zerar uma nota.
- **Dominios de terceira parte** tem peso baixo por ocorrencia mas cap alto: paginas modernas comumente contatam dezenas, e cada novo dominio amplia a superficie de rastreamento mesmo sem cookies.
- **Fingerprinting** e contado por *superficie unica* (nao por chamada) para evitar que sites legitimos usando canvas para graficos sejam penalizados varias vezes; o que importa e quantos vetores distintos sao acionados — alinhado com a metodologia da EFF Cover Your Tracks.
- **Cookies persistentes de 3rd party** sao penalizados duplo (categoria propria + extra) porque carregam o vetor classico de rastreamento entre sessoes.
- **Supercookies** recebem peso alto pois sobrevivem a limpeza de cookies.
- Os **caps** evitam que sites particularmente "ruidosos" (ex.: portais de noticias) recebam −200 e produzam uma nota uniforme F; preserva-se diferenciacao entre sites moderadamente e extremamente invasivos.

A formula esta em `lib/privacy-score.js` e e compartilhada entre background, popup e dashboard.

## Estrutura do codigo

```
manifest.json                 # Manifest V2: permissoes, scripts, recursos web-accessible
lib/
  etld.js                     # extracao de eTLD+1 (lista embutida de sufixos multi-nivel)
  privacy-score.js            # formula de pontuacao + escala A-F
background/
  background.js               # entrada: anexa listeners, roteia mensagens, atualiza badge
  tab-store.js                # estado por aba (resetado a cada navegacao)
  network-monitor.js          # webRequest.onBeforeRequest -> dominios 3rd party
  cookie-monitor.js           # parsing de Set-Cookie + supercookies HSTS/ETag
  cookie-sync.js              # deteccao de fragmentos de cookies em URLs cross-site
  hijacking-monitor.js        # heuristicas BeEF, IP bruto, redirecionamentos cross-site
content/
  page-bridge.js              # injeta os hooks de fingerprinting no contexto da pagina
  storage-probe.js            # le localStorage/sessionStorage/IndexedDB e reporta
injected/
  fingerprint-hooks.js        # executa no contexto da pagina; monkey-patch das APIs
popup/
  popup.html / popup.css / popup.js
dashboard/
  dashboard.html / dashboard.css / dashboard.js
icons/
  icon.svg
```

## Testes manuais sugeridos

| Sinal a validar | URL | O que deve aparecer |
|---|---|---|
| Dominios 3rd party | `https://www.cnn.com` ou portal de noticias BR | Dezenas de dominios externos com `script` e `image` |
| Cookies | `https://www.google.com` apos uma busca | Cookies 1st e 3rd party, persistente e sessao |
| Storage / IndexedDB | `https://web.whatsapp.com` ou `https://www.youtube.com` | Entradas em `localStorage` e bancos IndexedDB |
| Fingerprinting | `https://amiunique.org/fingerprint` | Eventos Canvas + WebGL + AudioContext |
| Fingerprinting (EFF) | `https://coveryourtracks.eff.org/` | Mesmas superficies + Navigator/Screen |
| Cookie syncing | Portal com ads (ex.: noticias) | Pares `dominio_a -> dominio_b` populados |
| Hijacking heuristica | Carregar um script de teste em `http://example.test/hook.js` (laboratorio) | Alerta "Padrao BeEF (hook.js)" |
| Privacy Score | Comparar `https://duckduckgo.com` (B/A) vs portal de noticias (D/F) | Nota acompanha os sinais |

Para validar os hooks de fingerprinting manualmente no console do DevTools de qualquer pagina:

```js
document.createElement("canvas").toDataURL();
new AudioContext().createOscillator();
```

Os eventos devem aparecer na aba **Fingerprinting** do dashboard.

## Privacidade e coleta de dados

A extensao **nao envia dados para servidores externos**. Toda a coleta e em memoria, por aba, e descartada quando a aba e fechada ou navegada. Em conformidade com a politica da Mozilla (vigente desde nov/2025), o manifest declara coleta vazia.

## Limitacoes conhecidas

- A lista de sufixos publicos embutida em `lib/etld.js` cobre os casos mais comuns; sufixos exoticos (ex.: `*.s3.amazonaws.com`) podem ser classificados como mesmo eTLD+1.
- `indexedDB.databases()` exige Firefox 126+; em versoes anteriores so `localStorage`/`sessionStorage` sao reportados.
- A deteccao de fingerprinting nao distingue uso legitimo (canvas para graficos, audio para tocadores) de uso para identificacao — segue a abordagem padrao de monitorar a superficie e deixar a inspecao do script chamador para o usuario.
- A heuristica de hijacking e indicativa, nao definitiva; falsos positivos sao possiveis em CDNs com nomes incomuns.
- A extensao nao bloqueia trackers — apenas detecta e apresenta, conforme escopo do roteiro.

## Licenca

Codigo entregue como exercicio academico. Uso livre para fins didaticos.
