# Etiquetas personalizadas dinâmicas (Metaobjetos `custom_label`)

## 1. Visão geral

### O que foi implementado

- Leitura do metafield de produto **`custom.custom_label`** (lista de referências ao metaobjeto **`custom_label`**).
- Renderização de até **3** etiquetas no **card de produto** (vitrine, coleções, recomendados, pesquisa, etc.), reutilizando as classes de **badge** do Dawn (`badge`, `badge--bottom-left`).
- Cores dinâmicas a partir dos campos **`background_color`** e **`text_color`** do metaobjeto, com fallback escuro/claro se estiverem vazios.
- **Prioridade visual:** as etiquetas custom aparecem **antes** das badges nativas no DOM; a badge nativa **“Promoção / em promoção”** (sale) **não é mostrada** quando existem etiquetas custom (para reduzir conflito e dar destaque ao conteúdo configurado). A badge **“Esgotado”** continua a ser mostrada quando o produto não está disponível.

### Objetivo

Centralizar rótulos de marketing/segmentação em **Metaobjetos** e associá-los aos produtos via metafield, mantendo o aspeto nativo do Dawn e um comportamento previsível em desktop e mobile.

---

## 2. Estrutura já existente utilizada

### Metaobjeto `custom_label`

| Campo               | Tipo (esperado) | Uso no tema                          |
|---------------------|-----------------|--------------------------------------|
| `title`             | Texto           | Texto visível da etiqueta          |
| `background_color`  | Cor             | Fundo da badge (CSS `background-color`) |
| `text_color`        | Cor             | Cor do texto (CSS `color`)           |

### Metafield no produto

- **Namespace / key:** `custom.custom_label`
- **Tipo:** lista de referências a entradas do metaobjeto `custom_label`
- **Liquid:** `card_product.metafields['custom']['custom_label']` — `.value` devolve a lista iterável de drops de metaobjeto.

### Ligação ao produto

Na Admin, cada produto pode ter várias referências selecionadas nesse metafield. O tema **não** cria definições; apenas lê o que já estiver configurado na loja.

---

## 3. Arquitetura da solução

### Onde encaixa no Dawn

O card de produto está em **`snippets/card-product.liquid`**. O Dawn coloca badges nativas (“Esgotado”, “Promoção”) dentro de **dois** contentores `.card__badge` (um dentro de `.card__inner > .card__content` e outro no `.card__content` exterior), espelhando o mesmo critério — o CSS do tema esconde um ou outro consoante o estilo do card (`standard` vs `card`, media, etc.).

### Lógica

1. No início do bloco do produto válido, calcula-se **`card_has_custom_labels`** com base no metafield e em `.value.size > 0`.
2. Em **ambas** as regiões `.card__badge`, o conteúdo passou a estar dentro de **`.card__badge--stack`** (flex + wrap) para alinhar várias badges sem rebentar o layout.
3. Se `card_has_custom_labels`, faz-se **`render`** do snippet **`card-product-custom-labels`** **antes** das spans nativas.
4. A condição da badge **sale** passou a exigir também **`card_has_custom_labels == false`**, implementando a precedência pedida em relação à promoção nativa.

### Ficheiros

| Ficheiro | Função |
|----------|--------|
| `snippets/card-product.liquid` | Atribui `card_has_custom_labels`; inclui CSS; envolve badges em `.card__badge--stack`; chama o snippet; ajusta lógica sale. |
| `snippets/card-product-custom-labels.liquid` | Itera a lista (máx. 3), lê campos do metaobjeto, emite `<span class="badge ... card-product-custom-label">`. |
| `assets/component-card-product-custom-labels.css` | Flex da pilha, alinhamento à direita quando `.card__badge.right`, `word-break`, `forced-colors`. |

---

## 4. Ficheiros criados e alterados

| Ficheiro | Criado / alterado | Resumo |
|----------|-------------------|--------|
| `snippets/card-product-custom-labels.liquid` | **Criado** | Renderização das etiquetas custom. |
| `assets/component-card-product-custom-labels.css` | **Criado** | Estilos mínimos da pilha e da badge custom. |
| `snippets/card-product.liquid` | **Alterado** | Metafield, duas zonas de badge, inclusão do CSS, regra sale. |
| `docs/dynamic-custom-labels-metaobjects.md` | **Criado** | Esta documentação. |

---

## 5. Fluxo entre componentes

1. O produto na loja tem o metafield **`custom.custom_label`** preenchido com N referências a entradas `custom_label`.
2. Ao renderizar `card-product`, o Liquid avalia se existe lista com pelo menos um item → `card_has_custom_labels`.
3. Se sim, o snippet percorre **até 3** referências; para cada uma lê `title` (`.value` ou fallback), cores, aplica estilos inline e classes Dawn de badge.
4. As badges nativas são avaliadas **depois** na mesma pilha: esgotado mantém-se; promoção só aparece se **não** houver etiquetas custom.

---

## 6. Conceitos técnicos

### Metafields de produto

`card_product.metafields['custom']['custom_label']` devolve o objeto metafield. Para listas, **`.value`** contém a coleção Liquid a iterar.

### Lista de referências a metaobjetos

Cada elemento do `for` é um **drop** de metaobjeto. Campos definidos na definição acede-se tipicamente como **`campo.value`** (ex.: `label.title.value`), alinhado com a [documentação Shopify sobre metaobjetos em Liquid](https://shopify.dev/docs/api/liquid/objects/metaobject).

### Cores

Os valores são interpolados em `style="background-color: …; color: …"`. Se o tipo “cor” da Admin devolver um formato que o browser aceite (hex, `rgb()`, etc.), aplica-se diretamente. Se vier vazio, usam-se fallbacks `#1a1a1a` / `#ffffff` (documentar ao lojista que cores inválidas podem ser ignoradas pelo browser).

### Badges nativas Dawn

Reutilizam-se `badge` e `badge--bottom-left` de `base.css`, garantindo tipografia e padding consistentes.

### Prioridade visual

- **Ordem no DOM:** custom primeiro.
- **Promoção nativa:** suprimida quando há custom (menos ruído; destaque ao metaconteúdo).
- **Esgotado:** mantido (estado crítico de stock).

### Responsividade

`.card__badge--stack` usa `flex-wrap: wrap` e `max-width: 100%` para que várias etiquetas quebrem linha dentro da área da badge.

### Acessibilidade

- Texto da etiqueta com `escape`.
- Contraste não é validado automaticamente: as cores vêm da configuração do lojista — ver limitações.
- `forced-colors`: contorno simples para modo de alto contraste do SO.

---

## 7. Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| Snippet dedicado | Manter `card-product.liquid` legível e lógica num único sítio reutilizável. |
| Máximo **3** etiquetas | Evitar poluição visual e overflow em grelhas densas; prioridade explícita às primeiras da lista na Admin. |
| Duas zonas de badge no Dawn | Manter paridade com o comportamento nativo (inner/outer); cada uma recebe a mesma pilha. |
| Ocultar só **sale** quando há custom | Equilíbrio entre “precedência” pedida e utilidade do estado **esgotado**. |
| Estilos inline para cores | Metafields de cor não mapeiam 1:1 para classes de esquema do tema; inline é o padrão mais direto. |
| CSS extra mínimo | Só o necessário para flex e limites; o aspeto base vem de `.badge`. |

### Alternativas consideradas

- **Ocultar também “Esgotado”** quando há custom — rejeitado (prejudica clareza de stock).
- **Aumentar o limite além de 3** — possível alterando `max_custom_labels` no snippet.
- **Classe CSS por label** — possível no futuro com handles, mas exigiria convenção de nomes.

### Limitações

- Contraste texto/fundo depende do lojista.
- Entradas de metaobjeto em **rascunho** (capability publishable) podem não aparecer no storefront.
- O tema **não** valida se a string de cor é CSS válido.

---

## 8. Guia de QA

### 8.1 Configurar na Admin

1. **Conteúdo → Metaobjetos:** confirmar definição `custom_label` e entradas com `title`, `background_color`, `text_color`.
2. **Produto → Metafields:** no produto de teste, campo **Custom Label** (`custom.custom_label`), associar uma ou mais entradas.

### 8.2 Cenários

| # | Passos | Resultado esperado |
|---|--------|----------------------|
| A | Produto **sem** metafield ou lista vazia | Só badges nativas (comportamento Dawn). |
| B | Uma etiqueta custom, produto em stock, **sem** promoção | Uma badge custom com cores e texto corretos. |
| C | Custom + `compare_at_price` > `price` (em promoção) | Vê-se custom; **não** vê badge “Promoção” nativa. |
| D | Custom + produto **esgotado** | Vê-se custom **e** badge “Esgotado”. |
| E | 5 entradas no metafield | No máximo **3** badges custom. |
| F | Entrada com `title` vazio | Essa entrada é ignorada; as outras podem aparecer. |
| G | Mobile / grelha estreita | Badges quebram linha (`flex-wrap`), sem overflow horizontal óbvio. |

### 8.3 Edge cases

- Metaobjeto removido da lista mas ainda em cache de tema: atualizar página / invalidar cache.
- Apenas cores sem título: entrada ignorada.

---

## 9. Resumo final

### Entregue

- Integração Liquid + snippet + CSS mínimo.
- Prioridade: custom primeiro; sale nativa condicionada; esgotado preservado.
- Limite de 3 etiquetas custom por card.

### Pontos de atenção

- Garantir que o metafield está **preenchido e publicado** no produto usado nos testes.
- Ajustar `max_custom_labels` no snippet se a loja precisar de mais/menos visibilidade.
- Para “segurança” ou regras de negócio fortes, isto é apenas **camada de apresentação**; não substitui controlo de preço ou disponibilidade no checkout.
