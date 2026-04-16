# Produtos relacionados em posts de blog (metacampo `custom.related_products`)

**Funcionalidade:** produtos relacionados no blog via metacampo — documentação técnica da implementação no tema.

## 1. Visão geral

### O que foi implementado

- Novo **bloco** `related_products` na secção nativa **`main-article`** (template de artigo do Dawn).
- O bloco lê o metacampo **`custom.related_products`** no objeto **Article** (lista de referências a produtos).
- São exibidos **no máximo 4** produtos válidos, em **grade ou carrossel** (configurável em desktop e em mobile), alinhado à secção **Featured collection** (`card-product`, CSS de coleção/cartão/slider).
- **Loja (storefront):** não há markup quando o metacampo está vazio ou só contém referências inválidas — sem “buracos” visuais.
- **Editor de tema:** quando o bloco existe mas não há produtos no metacampo, aparece um **aviso** para o lojista configurar o metacampo.

### Objetivo

Usar o blog como canal de **venda contextual**: cada post pode recomendar produtos escolhidos manualmente no Admin, sem hardcode no tema.

---

## 2. Metacampo necessário

### Objeto

- **Blog post / Article** (`Article` no Liquid).

### Namespace e key (acordo com a loja)

| Campo | Valor sugerido / em uso |
|--------|-------------------------|
| **Namespace** | `custom` |
| **Key** | `related_products` |
| **Acesso no Liquid** | `article.metafields.custom.related_products` |

### Tipo recomendado

- **`list.product_reference`** (lista de referências a produtos).

Motivos:

- Permite **vários** produtos num único campo.
- Cada entrada é um **produto real** do catálogo (SKU, URL, preço e imagem atualizados pela Shopify).
- O limite “até 4” na vitrine é aplicado no **tema** (a lista no Admin pode ter mais entradas; ver secção 7).

**Alternativa:** um único metacampo `product_reference` não cobre múltiplos produtos sem vários metacampos ou JSON.

### Limite de 4 produtos

- O tema percorre `article.metafields.custom.related_products.value`, ignora entradas em branco e **interrompe após 4 produtos válidos** (`break` no loop).
- Se o lojista configurar 6 produtos no metacampo, **só os 4 primeiros válidos** são mostrados.
- A **documentação no schema** do bloco (parágrafo informativo) lembra este comportamento.

### Onde o lojista preenche (Admin)

1. **Conteúdo** → **Posts do blog** → abrir o artigo.
2. Área de **metacampos** do post (normalmente no fim do formulário do artigo).
3. Campo **Related products** (ou o nome definido ao criar o metacampo) → selecionar até N produtos (recomendado até 4 para consistência com a vitrine).

### Criação do metacampo (fora do repositório do tema)

O ficheiro do tema **não cria** definições de metacampo na loja. O lojista (ou dev) deve criar em:

**Configurações** → **Dados personalizados** → **Posts do blog** → **Adicionar definição**

- Nome: ex. “Produtos relacionados”
- Namespace e key: `custom` / `related_products`
- Tipo: **Lista de referências de produto**

Se a loja **já** utiliza `custom.related_products`, basta garantir que o tipo é lista de produtos e preencher nos artigos.

---

## 3. Arquitetura da solução

### Onde encaixa no Dawn

- **`sections/main-article.liquid`**: secção única do artigo; contém o `<article class="article-template">` e o loop `{% for block in section.blocks %}`.
- Foi adicionado o caso **`when 'related_products'`**, que:
  - carrega os mesmos **CSS/JS** necessários para `card-product` e **quick add** (quando configurado), no mesmo padrão da secção **Featured collection**;
  - faz `{% render 'article-related-products', article: article, block: block, section: section %}`.

### Por baixo do conteúdo e posição configurável

- O **`templates/article.json`** inclui o bloco `related_products` **depois** do bloco `content` na `block_order` predefinida.
- No **editor de tema**, o lojista pode **reordenar** os blocos (por exemplo, colocar produtos relacionados antes de “Partilhar”), sem alterar código — OS 2.0.

### Snippet dedicado

- **`snippets/article-related-products.liquid`**: toda a lógica de leitura do metacampo, contagem até 4, renderização condicional, título/subtítulo, grid e `card-product`.

### Reuso Dawn

- **`snippets/card-product.liquid`**: um `render` por produto, com `skip_styles` após o primeiro cartão (padrão Dawn).
- **CSS:** `component-card.css`, `component-price.css`, `template-collection.css`, `mask-blobs.css` (se forma “blob”), `quick-add.css` + scripts conforme `quick_add` — espelhando **Featured collection**.

### Grade vs carrossel (desktop e mobile)

- No bloco existem duas opções independentes: **layout no desktop** e **layout no mobile** — cada uma pode ser **grade** ou **carrossel** (mesmo padrão da secção *Featured collection*: `slider-component`, botões anterior/seguinte, `component-slider.css`).
- O carrossel **só ativa** quando há **mais produtos visíveis do que colunas** na respetiva vista (ex.: 3 produtos com 2 colunas no mobile → carrossel no mobile; 4 produtos com 4 colunas no desktop → grade no desktop mesmo com “carrossel” escolhido, porque tudo cabe num ecrã).
- O **JavaScript** do slider faz parte do **`global.js`** do Dawn (`slider-component`); não é necessário um ficheiro JS extra.

---

## 4. Ficheiros criados e alterados

| Ficheiro | Função |
|----------|--------|
| `snippets/article-related-products.liquid` | **Novo.** Lógica do metacampo, limite 4, grid, `card-product`, placeholder no editor. |
| `sections/main-article.liquid` | **Alterado.** Caso `related_products` + carregamento de assets; bloco no `{% schema %}` com settings. |
| `templates/article.json` | **Alterado.** Instância do bloco `related_products` e ordem após `content`. |
| `locales/en.default.schema.json` | Traduções de schema do bloco (EN). |
| `locales/pt-BR.schema.json` | Traduções de schema do bloco (PT-BR). |
| `locales/*.schema.json` (outros idiomas) | Entrada `related_products` em `main-article.blocks` (textos EN de fallback para validação/consistência). |
| `locales/en.default.json`, `locales/pt-BR.json` | Chaves `blogs.article.*` para lista ARIA e mensagens do editor. |
| `locales/*.json` (outros storefront) | Mesmas chaves em inglês (fallback) para evitar `TranslationKeyMissing` no theme check. |
| `docs/blog-related-products-metafield.md` | **Este documento.** |

---

## 5. Fluxo entre componentes

1. O visitante abre um **URL de artigo** → Shopify carrega o template **`article`** → secção **`main-article`**.
2. O loop de **blocos** percorre `featured_image`, `title`, `share`, `content`, **`related_products`**, etc.
3. No bloco **`related_products`**, o Liquid carrega assets e chama o **snippet** com `article`, `block`, `section`.
4. O snippet lê **`article.metafields.custom.related_products.value`**, calcula quantos produtos válidos existem (máx. 4) e decide:
   - **Loja + ≥1 produto:** secção com título (se preenchido), subtítulo opcional, `<ul role="list">` e um `<li>` por produto com **`card-product`**.
   - **Loja + 0 produtos:** sem output HTML.
   - **Editor + 0 produtos:** caixa de ajuda com texto traduzido.
5. O **card** usa `section_id` derivado de `section.id` e `block.id` para IDs únicos de modais/quick add.

---

## 6. Conceitos técnicos

| Conceito | Uso nesta feature |
|----------|-------------------|
| **Article** | Objeto global `article` no template de artigo; fonte de `metafields` e conteúdo. |
| **Metafields** | `custom.related_products` guarda a lista de produtos definida no Admin. |
| **Lista de referências** | `.value` devolve uma lista iterável de objetos **Product** (quando o tipo é `list.product_reference`). |
| **Renderização condicional** | Só há `<section>` de produtos na loja se existir pelo menos um produto válido após o filtro e o limite. |
| **Grade / carrossel** | Classes `grid`, `product-grid`, `slider`, `slider--desktop`, `slider--tablet`, `slider-component` (Dawn), conforme as opções do bloco. |
| **Snippets Dawn** | `card-product` para imagem, título, preço e CTA de produto. |
| **Responsividade** | Colunas mobile/desktop configuráveis no bloco (1–4 desktop, 1–2 mobile). |
| **Acessibilidade** | `role="list"` na lista; `aria-labelledby` se há título, senão `aria-label` na lista; heading semântico `<h2>`. |
| **JS** | Apenas quando `quick_add` ≠ `none` (reuso do padrão Dawn: `product-form.js`, `quick-add.js`, etc.). |

---

## 7. Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| **`list.product_reference`** | Seleção manual múltipla; um metacampo só. |
| **Bloco em `main-article`** | Mantém tudo no mesmo template OS 2.0; ordem arrastável; sem secção extra no JSON. |
| **Namespace/key fixos no código** | Acordo explícito com a loja (`custom.related_products`); fácil de auditar. |
| **Limite 4 no Liquid** | Proteção mesmo que o Admin permita mais itens na lista. |
| **Carrossel opcional por viewport** | O lojista escolhe grade ou carrossel em desktop e em mobile; o tema só aplica carrossel quando há mais slides do que colunas (comportamento alinhado à *Featured collection*). |
| **Placeholder só no `request.design_mode`** | Evita ruído na loja e orienta o lojista no editor. |

**Limitações**

- O tema **não valida** se o metacampo existe na loja; se o namespace/key for outro, é preciso alterar o snippet (comentário no topo indica o contrato).
- Produtos **removidos** ou inacessíveis podem aparecer como entrada vazia — são ignorados.
- **Quick add em massa (bulk)** no blog pode ser pesado; o default do bloco é **`none`**.

---

## 8. Guia de QA

### 8.1 Criar / confirmar o metacampo

1. Admin → **Configurações** → **Dados personalizados** → **Posts do blog**.
2. Criar (ou confirmar) definição: namespace `custom`, key `related_products`, tipo **Lista de referências de produto**.

### 8.2 Ativar o bloco no tema

1. **Loja online** → **Temas** → **Personalizar** → navegar até um **artigo** de blog.
2. Clicar na secção **Post do blog** e confirmar que o bloco **Produtos relacionados (metacampo)** existe (ou adicioná-lo a partir de “Adicionar bloco”).
3. Arrastar o bloco **por baixo do conteúdo** (ou outra posição desejada).

### 8.3 Preencher o metacampo no artigo

1. Admin → **Conteúdo** → **Posts do blog** → editar um artigo.
2. Preencher **Related products** com 1–4 produtos (ou mais para testar o limite).

### 8.4 Secção visível quando preenchido

1. Na loja (não editor), abrir o artigo.
2. **Esperado:** bloco com título (default ou personalizado) e grelha de cartões; imagem, título, preço e link para o produto.

### 8.5 Secção invisível quando vazio

1. Remover todos os produtos do metacampo (ou usar artigo sem valores).
2. **Esperado:** nenhum bloco visual de produtos na loja; layout sem espaço reservado vazio.

### 8.6 Limite de 4

1. Associar **5 ou mais** produtos no metacampo.
2. **Esperado:** apenas **4** cartões na página.

### 8.7 Layout 1, 2, 3 e 4 produtos

1. Testar com 1, 2, 3 e 4 produtos.
2. **Esperado:** grelha estável; sem cartões partidos; espaçamento coerente com o tema.

### 8.8 Desktop e mobile

1. Redimensionar janela ou usar ferramentas de dispositivo.
2. Ajustar **Colunas no desktop** e **Colunas no mobile** no bloco.
3. **Esperado:** quebras de linha corretas; cartões legíveis em mobile.

### 8.9 Layout grade vs carrossel (desktop e mobile)

1. No bloco, definir **Layout no desktop** = Carrossel e **Colunas no desktop** = 2; usar artigo com **3** produtos no metacampo.
2. **Esperado:** no desktop aparecem botões de slider e deslize horizontal (mais itens do que colunas).
3. Repetir com **Layout no mobile** = Carrossel, **Colunas no mobile** = 1 e 2 produtos.
4. **Esperado:** em viewport estreito, carrossel quando `produtos > colunas`; com **grade** em ambos, sem botões de slider.

### 8.10 Preço, imagem, título e CTA

1. Confirmar que cada cartão mostra imagem (ou fallback do tema), título clicável, preço e ações esperadas do `card-product` (conforme `quick_add`).

### 8.11 Quick add

1. No bloco, definir **Quick add** para **Standard** (ou **Bulk** se necessário).
2. **Esperado:** botões/modais funcionam como na coleção; sem erros de consola óbvios.

### 8.12 Edge cases

| Cenário | Resultado esperado |
|---------|---------------------|
| Metacampo inexistente na loja | Lista `.value` vazia; sem output na loja; dica no editor se o bloco existir. |
| Lista vazia `[]` | Igual ao anterior. |
| Referências quebradas no meio da lista | Ignoradas; contam-se só produtos válidos até 4. |
| Título do bloco em branco | Sem `<h2>`; a lista usa `aria-label` traduzido. |

---

## 9. Resumo final

### Entregue

- Bloco **`related_products`** em **`main-article`**, integrado ao **`article.json`**.
- Snippet **`article-related-products`** com leitura de **`custom.related_products`**, máximo 4 produtos e reuso de **`card-product`** + estilos Dawn.
- Documentação e strings de tradução (schema + storefront).

### Pontos de atenção

- Confirmar na loja que o metacampo é **`custom.related_products`** e tipo **lista de produtos**.
- Para outro namespace/key, ajustar a primeira atribuição no snippet (`related_meta`).
- **Bulk quick add** no blog é opcional; usar só se fizer sentido de UX e performance.
