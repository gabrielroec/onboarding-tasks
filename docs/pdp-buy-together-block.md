## 1. Visão geral da funcionalidade

Foi implementado um novo bloco de PDP chamado **“Compre junto”** (tipo `buy_together`) dentro da seção **`main-product`** do Dawn.

Objetivo: promover cross-sell mostrando um produto complementar (definido manualmente via metacampo) e permitir **adicionar os 2 itens ao carrinho** com **um único clique**.

Entrega inclui:

- Leitura do metacampo `custom.product_recommended` no produto principal.
- Renderização condicional (não aparece se o metacampo estiver vazio/inválido ou se o recomendado não estiver em estoque).
- Botão único: **“Adicionar os 2 itens ao Carrinho”**.
- Add-to-cart via AJAX em uma requisição (`/cart/add`) com **2 itens**.
- Atualização do `cart-drawer`/`cart-notification` no padrão Dawn (sections + `cart.renderContents()`).
- Loading state e mensagens de erro sem quebrar a PDP.

---

## 2. Metacampo utilizado

- **Metacampo**: `custom.product_recommended`
- **Objeto**: `Product`
- **Tipo esperado**: **referência de produto** (`product_reference`)

### Como o tema consome o metacampo

No Liquid:

- `product.metafields.custom.product_recommended` → objeto Metafield
- `product.metafields.custom.product_recommended.value` → **objeto Product** recomendado

### O que o lojista configura no Admin

1. Admin → **Configurações** → **Dados personalizados** → **Produtos**.
2. Definição `custom.product_recommended` do tipo **Referência de produto**.
3. Em cada produto, preencher o campo com o produto complementar desejado.

---

## 3. Arquitetura da solução

### Onde a feature foi encaixada na PDP do Dawn

- A PDP usa a seção **`sections/main-product.liquid`** com blocos configuráveis.
- Foi adicionado um novo bloco `buy_together`, permitindo que o lojista controle a **posição** do bloco na PDP (arrastar/soltar no editor).

### Como o metacampo é lido e validado

O snippet:

- Resolve o produto recomendado via `metafield.value`.
- Seleciona a variante do recomendado via `selected_or_first_available_variant`.
- Valida “em estoque” de forma conservadora:
  - Se `inventory_management == 'shopify'` → só renderiza se `inventory_quantity > 0`.
  - Caso contrário → renderiza se `available == true`.

### Como a variante selecionada do produto principal é obtida

No clique do botão, o JS lê **o input real do formulário principal**:

- `document.getElementById(product_form_id).querySelector('[name=\"id\"]').value`

Isso respeita totalmente o comportamento nativo do Dawn (troca de variante atualiza este input).

### Como os 2 itens são adicionados ao carrinho

O JS faz um `POST` para `routes.cart_add_url` (`/cart/add`) enviando um `FormData` com:

- `items[0][id]` + `items[0][quantity]` (produto principal / variante selecionada)
- `items[1][id]` + `items[1][quantity]` (produto recomendado / 1 unidade)

Quando existe `cart-drawer` ou `cart-notification`, também envia:

- `sections` (ids das seções que o carrinho precisa re-renderizar)
- `sections_url` (path atual)

E em seguida chama `cart.renderContents(response)` como faz o `product-form.js`.

### Feedback e estados de erro

- Loading state: mesma convenção do Dawn (`.loading` + `.loading__spinner`).
- Erro de API: exibe mensagem no container do bloco (sem quebrar PDP) e publica `PUB_SUB_EVENTS.cartError`.
- Sucesso: publica `PUB_SUB_EVENTS.cartUpdate` e re-renderiza o cart drawer/notificação.

---

## 4. Arquivos criados e alterados

### Criados

- `snippets/pdp-buy-together.liquid`
  - Render do bloco; leitura/validação do metacampo; markup semântico + botão + erro.
- `assets/pdp-buy-together.js`
  - Clique “Adicionar os 2 itens”; POST `/cart/add` com `items[]`; integração com cart drawer.
- `assets/component-buy-together.css`
  - Estilos mínimos do bloco, alinhados aos tokens do Dawn.
- `docs/pdp-buy-together-block.md`
  - Esta documentação.

### Alterados

- `sections/main-product.liquid`
  - Novo `when 'buy_together'` e novo bloco no schema.
- `templates/product.json`
  - Bloco adicionado ao template por padrão (reordenável).
- `locales/en.default.schema.json`
  - Traduções do schema do bloco.
- `locales/pt-BR.schema.json` + `locales/*.schema.json`
  - Entrada equivalente para evitar erros de tradução no theme check.
- `locales/en.default.json`, `locales/pt-BR.json` + `locales/*.json`
  - Strings do botão e erro.

---

## 5. Como os arquivos conversam entre si

1. `main-product.liquid` renderiza blocos na PDP.
2. No bloco `buy_together`, o Liquid chama `snippets/pdp-buy-together.liquid`.
3. O snippet resolve o produto recomendado via `custom.product_recommended` e, se válido/em estoque, renderiza o componente `<buy-together>` com:
   - `data-product-form-id` (para obter a variante selecionada do produto principal)
   - `data-recommended-variant-id` (variante do recomendado)
4. `assets/pdp-buy-together.js` intercepta o clique e faz `/cart/add` com os 2 itens.
5. Se existir `cart-drawer`/`cart-notification`, o JS solicita `sections` e chama `cart.renderContents()` para atualizar UI no padrão Dawn.

---

## 6. Explicação técnica dos conceitos usados

- **Product metafield (referência)**: `metafield.value` retorna objeto `Product`.
- **Variante selecionada**: o Dawn mantém a variante atual no `input[name=id]` do `product-form`.
- **Disponibilidade de estoque**: verificada no Liquid antes de renderizar o bloco.
- **AJAX cart**: `/cart/add` com `items[]` permite adicionar múltiplos itens em uma requisição.
- **Sections rendering**: o Dawn atualiza cart drawer/notificação enviando `sections` e chamando `renderContents`.
- **Acessibilidade**: erro com `role=\"alert\"`, botão com estado de loading, textos/alt adequados.

---

## 7. Decisões técnicas

- **Inserir como bloco da `main-product`**: mantém arquitetura OS 2.0, posição configurável e revisão fácil.
- **Variante do produto principal no clique**: evita assumir “primeira variante” e respeita troca de variantes.
- **Variante do recomendado**: `selected_or_first_available_variant` para previsibilidade, com validação de estoque.
- **Validação “em estoque” conservadora**: não exibe recomendado com `inventory_quantity == 0` quando o estoque é gerenciado pela Shopify.
- **Add-to-cart com `items[]`**: uma operação lógica para o usuário e consistente com AJAX cart.

Alternativas consideradas:

- Duplicar submit do `product-form` e fazer segunda chamada: descartado (duas operações e mais chance de inconsistência).
- Carregar o produto recomendado por handle via JS: descartado (metacampo já fornece referência de produto no Liquid).

Limitações/observações:

- Se o metacampo apontar para o mesmo produto, o bloco não renderiza (proteção simples).
- O bloco adiciona **1 unidade** do recomendado e respeita a quantidade selecionada do principal (se houver campo `quantity`).

---

## 8. Guia completo para QA testar

### 8.1 Configurar metacampo

1. Admin → Configurações → Dados personalizados → Produtos.
2. Criar/confirmar `custom.product_recommended` como **Referência de produto**.

### 8.2 Validar renderização do bloco

- **Com metacampo vazio**: bloco **não aparece**.
- **Com metacampo preenchido e recomendado em estoque**: bloco **aparece** com imagem, título, preço e botão.
- **Com recomendado sem estoque** (estoque gerenciado e `inventory_quantity == 0`): bloco **não aparece**.

### 8.3 Testar variantes (produto principal)

1. Produto principal com múltiplas variantes.
2. Trocar variante no picker.
3. Clicar “Adicionar os 2 itens ao Carrinho”.
4. **Esperado**: a variante adicionada do principal é a variante atualmente selecionada.

### 8.4 Testar add-to-cart (2 itens)

1. Garantir recomendado em estoque.
2. Clicar no botão.
3. **Esperado**: carrinho/cart drawer mostra **2 itens** (principal + recomendado).

### 8.5 Testar erro de rede/API

1. Simular falha (offline/devtools) e clicar no botão.
2. **Esperado**: mensagem de erro aparece no bloco e a PDP não quebra; loading encerra.

### 8.6 Mobile

1. Testar em viewport pequeno.
2. **Esperado**: layout não quebra; botão full width; imagem/título/preço legíveis.

Edge cases:

- Metacampo aponta para produto deletado/indisponível → bloco não renderiza.
- Metacampo aponta para o mesmo produto → bloco não renderiza.

---

## 9. Resumo final

Entregue:

- Bloco “Compre junto” na PDP via `custom.product_recommended`.
- Add-to-cart duplo em um clique com `/cart/add` e `items[]`.
- Integração com cart drawer/notificação no padrão Dawn.
- Estilos mínimos + loading + erro + documentação completa.

Pontos de atenção:

- Confirmar que `custom.product_recommended` é **referência de produto**.
- A regra de “em estoque” considera `inventory_quantity > 0` quando o estoque é gerenciado pela Shopify.

