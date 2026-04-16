# Seção “Vídeo e Texto” — Dawn

{% comment %}
Feature: Video and Text Section
Description: Documentação técnica da seção "Vídeo e Texto" baseada em "Imagem e Texto"
{% endcomment %}

## 1. Visão geral da funcionalidade

Foi criada uma nova seção do tema chamada **“Vídeo e Texto”** (type: `video-with-text`), baseada estrutural e visualmente na seção nativa do Dawn **“Imagem e Texto”** (`image-with-text`).

Objetivo: oferecer ao lojista uma forma consistente (com o padrão do Dawn) de exibir **um vídeo + conteúdo textual** lado a lado, com suporte às fontes obrigatórias:

- **YouTube (URL)**
- **Vimeo (URL)**
- **Upload de vídeo (arquivo hospedado na Shopify)**

---

## 2. Relação com a seção original

### Seção base utilizada
- **Base**: `sections/image-with-text.liquid`
- **Estilos reutilizados**: `assets/component-image-with-text.css`

### O que foi reaproveitado
- Grade, classes e estrutura HTML do `image-with-text` (layout, alinhamento, sobreposição, cor, padding).
- Blocos e conteúdo textual (heading, caption, richtext, button).
- Configurações de layout e estilo (altura, largura no desktop, ordem dos elementos, alinhamentos, esquemas de cor, padding).

### O que foi adaptado
- O campo `image_picker` foi substituído por **configuração de vídeo**, com escolha explícita de fonte.
- A “mídia” passou a ser renderizada usando o componente do Dawn **`deferred-media`**, garantindo:
  - carregamento sob demanda
  - iframe/vídeo responsivo
  - poster/cover antes de carregar o player

### O que foi criado especificamente para vídeo
- Snippet `snippets/video-with-text-media.liquid` para:
  - consolidar a lógica de fonte (YouTube/Vimeo/Upload)
  - validar e escolher o fallback
  - manter a section principal limpa e fácil de revisar

### Tipos de bloco (`video_*`)
Os blocos de conteúdo usam tipos com prefixo (`video_heading`, `video_caption`, `video_text`, `video_button`) em vez de nomes genéricos como `heading`, para evitar conflitos de validação no Theme Editor (“type já está em uso”) e manter identificadores únicos e rastreáveis.

---

## 3. Arquitetura da solução

### 3.1 Estrutura

- `sections/video-with-text.liquid`
  - Mantém o “esqueleto” do `image-with-text`.
  - Renderiza a mídia chamando `{% render 'video-with-text-media' %}`.
  - Mantém os blocos (heading/caption/text/button) e as configurações de layout.

- `snippets/video-with-text-media.liquid`
  - Decide qual fonte usar com base em `section.settings.video_source`.
  - Usa `video_url` (YouTube/Vimeo) ou `video` (upload).
  - Renderiza um `deferred-media` com poster e `<template>` para o player.
  - Se inválido/ausente:
    - no storefront: renderiza placeholder seguro (sem quebrar layout)
    - no Theme Editor (`request.design_mode`): mostra uma mensagem informativa

### 3.2 Suporte às fontes

#### YouTube / Vimeo
- Schema usa `type: "video_url"` com `accept` específico (`youtube` / `vimeo`).
- A Shopify já faz a **extração do ID do vídeo** e expõe `.id` e `.type`.
- O snippet monta o embed (`youtube.com/embed/{{id}}` / `player.vimeo.com/video/{{id}}`) dentro do `deferred-media`.

#### Upload (arquivo)
- Schema usa `type: "video"` (vídeo hospedado na Shopify).
- Renderização via `video_tag`, com flags configuráveis (loop/muted/controls).

### 3.2.1 Play não reage / só placeholder (YouTube)

O `DeferredMedia` do Dawn (`assets/global.js`) só anexa o listener de clique se o botão do poster tiver um **`id` começando com `Deferred-Poster-`**. Sem isso, o ícone de play parece “morto”.

Além disso, o CSS do Dawn combina **`deferred-media` + `media`** para o poster preencher corretamente o container.

### 3.2.2 Prioridade do poster (thumbnail antes do play)

Ordem aplicada no snippet `snippets/video-with-text-media.liquid`:

1. **Imagem de capa** (`cover_image`), se estiver definida no editor — sempre prevalece sobre qualquer outra miniatura.
2. **Upload**: se não houver capa, usa o **frame de pré-visualização** do vídeo hospedado (`preview_image`), como no Dawn.
3. **YouTube** sem capa: miniatura oficial do YouTube (`i.ytimg.com/.../hqdefault.jpg`) com base no ID extraído pelo setting `video_url`.
4. **Vimeo** sem capa: a Shopify só expõe `.id` e `.type` para `video_url`; não há URL de thumbnail oficial só com Liquid. O tema usa **`vumbnail.com/{id}.jpg`** como espelho da miniatura pública do vídeo. Vídeos privados ou com restrições podem falhar; nesse caso use **Imagem de capa** ou confirme que o vídeo é embedável publicamente.

Quando não há capa, preview nem URL externa válida, mantém-se o **placeholder** do tema.

### 3.3 Validações e fallback (robustez)

Casos tratados:
- fonte selecionada, mas campo correspondente vazio → **placeholder** no storefront e **aviso** apenas no editor.
- vídeo inexistente (upload não selecionado) → mesmo fallback.
- URL inválida → em geral o `video_url` não fornece `.id` válido; o snippet não quebra layout e cai no fallback.

Decisão de UX:
- No storefront, **não exibimos mensagens intrusivas**.
- No editor, exibimos uma mensagem curta para orientar o lojista.

### 3.4 Responsividade

No modo de altura **Adaptar à imagem**, o bloco de mídia usa **`padding-bottom` em percentagem** (igual ao `image-with-text` com imagem), calculado a partir do `aspect_ratio` do poster da Shopify ou, para miniatura externa (YouTube/Vimeo sem capa), proporção **16:9 (56,25%)**. O layout geral continua a usar as classes responsivas do `image-with-text`.

---

## 4. Arquivos criados e alterados

### Criados
- `sections/video-with-text.liquid`
  - Nova section “Vídeo e Texto”.
- `snippets/video-with-text-media.liquid`
  - Renderização e validação das fontes de vídeo.
- `docs/video-and-text-section.md`
  - Esta documentação.

### Alterados
- `locales/en.default.json`
- `locales/pt-BR.json`
- `locales/*.json` (propagação de fallback em inglês para evitar chaves faltantes)
- `templates/index.json`
  - Seção adicionada ao index conforme solicitado.

---

## 5. Como os arquivos conversam entre si

Fluxo:

1. O lojista adiciona a section **Vídeo e Texto** no editor.
2. O schema da section define as opções e salva em `section.settings.*`.
3. A section (`sections/video-with-text.liquid`) renderiza o layout e chama o snippet de mídia.
4. O snippet (`snippets/video-with-text-media.liquid`) escolhe a fonte:
   - YouTube → `youtube_video_url`
   - Vimeo → `vimeo_video_url`
   - Upload → `video`
5. O snippet renderiza `deferred-media` com poster e player responsivo.
6. As labels/infos no editor vêm de `locales/*.json` via `t:sections.video-with-text.*`.

---

## 6. Explicação técnica (conceitos usados)

- **Sections e schema**: `sections/video-with-text.liquid` define settings e blocks.
- **`video_url`**: setting que valida URL e fornece `id`/`type` (YouTube/Vimeo).
- **`video`**: setting de vídeo hospedado (upload) para `video_tag`.
- **iframes**: usados apenas para embed externo, dentro do `deferred-media`.
- **`deferred-media`**: padrão do Dawn para carregar players sob demanda e manter responsividade.
- **Tratamento de erro/fallback**: placeholder seguro no storefront; aviso apenas no Theme Editor.

---

## 7. Decisões técnicas

- **Usar `video_url` em vez de parse manual**:
  - Mais robusto (a Shopify normaliza/extrai o ID).
  - Reduz chance de regex frágil e URLs variantes.
- **Usar `deferred-media`**:
  - Padrão Dawn, melhora performance e UX (poster + click-to-play).
- **Fallback silencioso no storefront**:
  - Evita “erros” visuais para clientes; mantém layout íntegro.

Limitações reais da plataforma consideradas:
- Upload de vídeo depende do recurso `type: "video"` (vídeo hospedado na Shopify).
- O tema não deve (e não pode) gerenciar upload customizado fora do Admin/Editor.

---

## 8. Guia de QA (passo a passo)

### 8.1 Adicionar a seção no Theme Editor
1. Abrir **Personalizar**.
2. Ir para **Home page**.
3. “Adicionar seção” → selecionar **Vídeo e texto**.

### 8.2 Configurar YouTube
1. Em “Fonte do vídeo” escolher **YouTube**.
2. Colar uma URL válida no campo **URL do YouTube**.
3. (Opcional) Definir **Imagem de capa** e **Descrição**.
4. Salvar e testar no preview.

**Esperado:** sem imagem de capa, o poster deve ser a **miniatura padrão do YouTube**; com capa, a capa substitui a miniatura. Ao clicar, o iframe do YouTube carrega e reproduz.

### 8.3 Configurar Vimeo
1. Selecionar **Vimeo**.
2. Colar URL válida no campo **URL do Vimeo**.
3. Salvar e validar.

**Esperado:** sem capa, miniatura espelhada do vídeo (serviço por ID; ver secção 3.2.2). Com **Imagem de capa**, o poster deve ser sempre a capa.

### 8.4 Configurar Upload
1. Selecionar **Upload**.
2. Selecionar um arquivo no campo **Vídeo enviado (upload)**.
3. Salvar e validar.

### 8.5 Validar link inválido / ausência de mídia
1. Selecionar YouTube/Vimeo e deixar URL vazia, ou inserir URL inválida.
2. No storefront:
   - **Esperado:** não quebrar layout; placeholder seguro (sem mensagem de erro).
3. No editor:
   - **Esperado:** mensagem informativa indicando que falta configurar o vídeo.

### 8.6 Responsividade
1. Testar em viewport mobile e desktop.
2. Validar que:
   - layout permanece consistente com `image-with-text`
   - o player mantém proporção e não “estoura” o container

### 8.7 Edge cases
- fonte “Upload” selecionada sem vídeo e sem cover image → placeholder.
- cover image presente sem vídeo → placeholder com poster.
- loop ativo no YouTube → verifica `playlist={{id}}` aplicado (padrão do Dawn).

---

## 9. Resumo final

Entregue:
- Nova seção **Vídeo e Texto** baseada em **Imagem e Texto**.
- Suporte a **YouTube, Vimeo e Upload**, com renderização responsiva.
- Tratamento robusto de configurações inválidas (fallback seguro + aviso só no editor).
- Seção adicionada no `templates/index.json` conforme pedido.

Pontos de atenção:
- Para melhor acessibilidade, recomenda-se preencher a **Descrição**.
- Upload depende do suporte de vídeo hospedado no Admin/Shopify.

