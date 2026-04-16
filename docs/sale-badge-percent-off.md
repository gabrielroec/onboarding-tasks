# Badge de promoção com percentual (% OFF)

## 1. Visão geral

### O que foi implementado

- Substituição do texto estático da badge de promoção (ex.: “Sale” / “Promoção”) por uma cadeia dinâmica **`[X]% OFF`**, onde **X** é o desconto percentual arredondado ao inteiro mais próximo.
- Cálculo com base em **`compare_at_price`** (preço original / de comparação) e **`price`** (preço atual), na fórmula:
  - \(\text{percent} = \frac{\text{compare\_at\_price} - \text{price}}{\text{compare\_at\_price}} \times 100\)
- A badge só faz sentido quando **`compare_at_price > price`**; o snippet inclui validações e um fallback para o texto clássico `on_sale` se os valores forem inválidos.
- Cobertura:
  1. **Card de produto** (`snippets/card-product.liquid`) — nos dois pontos onde o Dawn já mostrava a badge de sale.
  2. **PDP e qualquer uso de `price.liquid` com `show_badges: true`** — badge dentro de `snippets/price.liquid` (inclui `main-product`, `featured-product`, etc.).

### Objetivo

Tornar o desconto mais explícito para o cliente, mantendo a estrutura de classes e o comportamento CSS nativos do Dawn (`badge`, `price__badge-sale`, etc.).

---

## 2. Regra de negócio

### Cálculo do percentual

1. Valores em **centimos** (inteiros), como o Shopify expõe em Liquid.
2. Diferença: `diff_cents = compare_at_price - price`.
3. Arredondamento ao inteiro **mais próximo** sem usar floats obrigatórios:
   - `numerator = diff_cents * 100 + compare_at_price / 2` (divisão inteira na metade da base),
   - `percent = numerator / compare_at_price` (divisão inteira).
4. Se o resultado for **&lt; 1** mas ainda houver desconto real (`compare_at_price > price`), o percentual exibido é **forçado a 1** (evita “0% OFF” em descontos muito pequenos).

### Quando a badge de sale aparece (inalterado face ao Dawn)

- **Card:** mantém as condições existentes: produto disponível e `compare_at_price > card_product.price` (preços ao nível do **produto**).
- **Snippet de preço:** a visibilidade continua a ser controlada pelo CSS do Dawn (`.price--on-sale .price__badge-sale`, etc.); o texto interior passa a ser dinâmico quando `compare_at_price > price` no **target** (variante ou produto).

### Tradução

- Chave **`products.product.sale_percent_off`**: `"{{ percent }}% OFF"` (adicionada em `locales/*.json`).
- O parâmetro Liquid do filtro `t` é **`percent`**, alinhado ao placeholder da tradução.

---

## 3. Arquitetura da solução

### Card de produto

- O Dawn já usava `card_product.compare_at_price` e `card_product.price` para decidir se mostra a badge de promoção — são os **preços mínimos / agregados** expostos no objeto `product` para vitrine, coerentes com o “desde” quando há variação de preços.
- Nos **dois** blocos `.card__badge` do `card-product`, o texto da sale foi trocado por:
  - `{% render 'sale-badge-percent-label', compare_at_price: card_product.compare_at_price, price: card_product.price %}`

### PDP (e secções que reutilizam `price`)

- `sections/main-product.liquid` já faz `{% render 'price', product: product, use_variant: true, show_badges: true, ... %}`.
- No início de `price.liquid`, com `use_variant: true`, `target` é a **variante selecionada** (ou a primeira disponível); `compare_at_price` e `price` vêm dessa variante.
- A badge de sale no `price.liquid` passou a usar o mesmo snippet com esses dois valores.

### Troca de variante na PDP

- O Dawn (`assets/product-info.js`) faz fetch da secção com `?variant=` e substitui o nó `#price-{section.id}`.
- Como o HTML do bloco de preço (incluindo a badge) é **regerado no servidor** por Liquid, o percentual **atualiza automaticamente** para a variante selecionada, **sem JavaScript adicional** nesta feature.

---

## 4. Ficheiros criados e alterados

| Ficheiro | Função |
|----------|--------|
| `snippets/sale-badge-percent-label.liquid` | **Criado.** Cálculo + texto traduzido ou fallback. |
| `snippets/price.liquid` | **Alterado.** Badge sale chama o snippet; comentário de rastreio. |
| `snippets/card-product.liquid` | **Alterado.** Duas badges sale chamam o snippet; comentários. |
| `locales/*.json` (sem schema) | **Alterado.** Chave `sale_percent_off` após `on_sale`. |
| `docs/sale-badge-percent-off.md` | **Criado.** Esta documentação. |

---

## 5. Fluxo entre componentes

1. **Card:** `card_product` → `compare_at_price` / `price` ao nível do produto → snippet → tradução.
2. **PDP:** `product` + `use_variant: true` → `price.liquid` define `target` → `compare_at_price` / `price` da variante → snippet → tradução.
3. **Mudança de variante:** pedido à secção → novo HTML do `price` → novo percentual.

---

## 6. Conceitos técnicos

- **`price` / `compare_at_price`:** valores monetários inteiros (centimos).
- **Percentual:** razão diferença / original × 100, arredondado.
- **Liquid `render`:** snippet isolado, reutilizável.
- **Variante:** `selected_or_first_available_variant` no contexto `use_variant` do snippet de preço.
- **Acessibilidade:** o texto deixa de ser só “Promoção”; o número comunica a magnitude; cores continuam a vir do esquema da badge no tema.

---

## 7. Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| Snippet único | Um só sítio para fórmula e fallback. |
| Card com preço de **produto** | Igual à condição nativa de sale do card; evita divergência com o que o visitante já via. |
| PDP com preço de **variante** | Igual ao bloco de preço com `use_variant: true`. |
| Sem JS extra | O mecanismo nativo de atualização do preço já substitui o markup. |
| Mínimo 1% quando há desconto | Evita “0% OFF” por arredondamento em descontos muito pequenos. |

### Limitações

- No **card**, produtos com variantes a preços muito diferentes mostram um único percentual derivado dos **preços agregados** do produto — pode não coincidir com a variante mais barata/cara individualmente; é coerente com a lógica de “sale” já usada no Dawn para o card.
- **Volume pricing / quantity breaks:** o snippet usa o mesmo `compare_at_price` e `price` que o bloco de preço já tinha atribuído; cenários muito específicos de volume pricing devem ser validados em QA.

---

## 8. Guia de QA

| Cenário | Passos | Esperado |
|---------|--------|----------|
| Sem desconto | Produto sem `compare_at_price` ou `compare_at_price <= price` | Sem badge de sale (comportamento Dawn). |
| Com desconto no card | Coleção com produto em promoção | Badge com “N% OFF” (N inteiro). |
| Com desconto na PDP | Produto com variante em promoção | Badge com percentual correto. |
| Troca de variante | PDP, mudar para variante com outro par preço/compare | Percentual atualiza após o update do bloco de preço. |
| Arredondamento | Ex.: de 100 para 67 → 33% | Verificar valor esperado com a fórmula documentada. |
| Mobile | Mesmos fluxos em viewport estreita | Texto legível, sem quebrar layout (classes Dawn inalteradas). |

### Edge cases

- Desconto &lt; 1% após arredondamento: deve mostrar **1% OFF** (mínimo).
- `compare_at_price` nulo: fallback “Sale” / “Promoção” dentro do snippet (badge pode continuar escondida pelo CSS se não for sale).

---

## 9. Resumo final

### Entregue

- Snippet reutilizável, integração em **card** e **price** (PDP + featured product), traduções `sale_percent_off` nos locales.

### Pontos de atenção

- Ajustar textos em `locales` se quiserem “% de desconto” em vez de “% OFF”.
- Rever produtos com **muitas variantes** e mensagens de “desde” no card se o percentual agregado não for o desejado comercialmente.
