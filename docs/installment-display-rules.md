# Exibição de parcelamento (regras customizáveis) — Dawn

{% comment %}
Feature: Installment Display Rules
Description: Documentação técnica da exibição de parcelamento (card, PDP e total do carrinho)
{% endcomment %}

## 1. Visão geral da funcionalidade

Foi implementada uma **exibição informativa de parcelamento** em três pontos da loja (Dawn):

- **Card de produto (vitrine)**
- **Página de produto (PDP)**
- **Total do carrinho** (na página do carrinho e no **cart drawer**)

Objetivo: comunicar ao cliente uma condição de parcelamento (“Em até Nx de R$ Y sem juros”), **calculada automaticamente** com base em regras configuradas no tema, incentivando conversão sem inventar integração com gateway/pagamento.

---

## 2. Regra de negócio

### 2.1 Inputs (configuráveis no Theme Editor)

As regras são controladas por **Theme settings** (globais):

- **Habilitar/desabilitar** a feature
- **Quantidade máxima de parcelas** (\(max\))
- **Valor mínimo por parcela** (\(min\)) em **unidades inteiras da moeda** (ex.: `10` para R$ 10,00)
- **Template de mensagem** (com placeholders)
- **Toggles por contexto**: card, PDP e carrinho

### 2.2 Input de cálculo (por contexto)

O cálculo recebe um **valor base em centavos** (`amount_cents`) e retorna:

- `count`: quantidade final de parcelas (inteiro)
- `amount`: valor por parcela (formatado com `money`)

### 2.3 Como o sistema define a quantidade final de parcelas

O sistema escolhe a **maior quantidade de parcelas possível** que respeite simultaneamente:

1. \(count \le max\)
2. \(amount\_cents / count \ge min\_cents\)

Implementação:

- Converte `min` para centavos: `min_cents = min_units * 100`
- Se `min_cents > 0`, calcula o limite teórico:

\[
count\_possible = \left\lfloor \frac{base\_cents}{min\_cents} \right\rfloor
\]

- Aplica teto pelo máximo configurado:

\[
count = \min(count\_possible,\ max)
\]

- Garante que `count` nunca seja < 1.

### 2.4 Regra de mínimo por parcela

Se o valor base não permitir ao menos **2 parcelas** respeitando o mínimo por parcela, **não exibimos a mensagem** (evita UX estranha como “1x de …”).

Decisão: **não renderizar** quando `count < 2`. Isso é documentado como escolha de UX.

### 2.5 Arredondamento (valor da parcela)

O valor por parcela é exibido em centavos e precisa ser um inteiro.

Para evitar subestimar o valor (“mostrar parcela menor do que o real”), o cálculo exibe um **arredondamento para cima** quando existir resto:

- `per = floor(base_cents / count)`
- `remainder = base_cents % count`
- se `remainder > 0`, `per = per + 1`

Ou seja: exibimos a **maior parcela possível** (há cenários reais em que as primeiras parcelas ficam 1 centavo acima).

---

## 3. Arquitetura da solução

### 3.1 Estratégia escolhida

- **Liquid-only** para cálculo e renderização (sem JS extra)
- **Snippet reutilizável** (`snippets/installment-display.liquid`) recebe:
  - `amount_cents`
  - `context` (`card`, `pdp`, `cart`)
- **Integrações pontuais** nos 3 contextos (e drawer) chamam o snippet passando o valor base correto.

### 3.2 Por que essa estrutura

- Evita duplicação de regra de negócio em múltiplos arquivos.
- Mantém os pontos de integração simples (só escolhem o valor base).
- Coerente com o padrão Dawn: snippets pequenos e reutilizáveis, e CSS em `assets/component-*.css`.

### 3.3 JS é necessário?

Não. Na PDP, o Dawn já re-renderiza o bloco de preço ao trocar variante (via `product-info`), então a mensagem de parcelamento acompanha a variante **sem script adicional**.

---

## 4. Arquivos criados e alterados

### Criados

- `snippets/installment-display.liquid`
  - Snippet central da feature: cálculo + renderização do texto.
- `assets/component-installment-display.css`
  - Estilos discretos para a mensagem (cards/PDP/carrinho).
- `docs/installment-display-rules.md`
  - Este documento.

### Alterados

- `config/settings_schema.json`
  - Adicionado grupo **Parcelamento** com configurações globais.
- `config/settings_data.json`
  - Adicionadas chaves com valores iniciais (para o preset atual).
- `snippets/card-product.liquid`
  - Integração no card (vitrine) + inclusão do CSS.
- `sections/main-product.liquid`
  - Integração no bloco de preço da PDP + inclusão do CSS.
- `sections/main-cart-footer.liquid`
  - Integração no total da página do carrinho + inclusão do CSS.
- `snippets/cart-drawer.liquid`
  - Integração no total do cart drawer + inclusão do CSS.
- `locales/*.schema.json`
  - Traduções do schema para o novo grupo `settings_schema.installments.*`.
- `locales/*.json`
  - Fallback de tradução `general.installments.message` (usado se o template do tema estiver em branco).

---

## 5. Como os arquivos conversam entre si

Fluxo:

1. O lojista configura regras em **Theme settings** (`config/settings_schema.json` → salva em `settings_data.json`).
2. Em cada contexto (card/PDP/carrinho), o template escolhe um **valor base**:
   - produto → preço da variante (ou `price_min` quando o preço varia no card)
   - carrinho → `cart.total_price`
3. O contexto chama `render 'installment-display'` com:
   - `amount_cents: <valor em centavos>`
   - `context: 'card' | 'pdp' | 'cart'`
4. O snippet lê `settings.*`, calcula `count` e `per_installment_cents`, formata com `money` e imprime o texto.
5. CSS (`assets/component-installment-display.css`) garante consistência visual/responsiva.

---

## 6. Explicação técnica (conceitos usados)

- **Liquid**: usado para cálculo numérico simples (`divided_by`, `modulo`, `plus`) e controle de renderização por contexto.
- **schema / settings**: configurações globais do tema em `config/settings_schema.json` via chaves `settings.*`.
- **snippets**: reutilização do cálculo e do HTML em um único ponto.
- **formatação monetária**: `money` (e não formatação manual), respeitando moeda/locale da loja.
- **variante selecionada**: na PDP usamos `product.selected_or_first_available_variant.price`, que é o mesmo valor base usado pelo Dawn no bloco de preço (`use_variant: true`).
- **total do carrinho**: usamos `cart.total_price` (valor final estimado do pedido sem frete), coerente com o “Estimated total” exibido no Dawn.
- **responsividade**: mensagem é texto simples com `caption-large`, margens pequenas e sem layout fixo.
- **acessibilidade**: conteúdo textual (não depende de cor/ícone), mantendo legibilidade e hierarquia do Dawn.

---

## 7. Decisões técnicas

### 7.1 Base de valor no produto (card e PDP)

- **PDP**: `product.selected_or_first_available_variant.price`
  - Justificativa: representa o preço do estado atual da variante e acompanha re-render do Dawn na troca de variante.
- **Card**: usa `selected_or_first_available_variant.price`, mas quando `product.price_varies` usamos `product.price_min`.
  - Justificativa: evita mostrar parcela baseada numa variante mais cara quando o card mostra “a partir de”.

### 7.2 Base de valor no carrinho

- **Carrinho**: `cart.total_price`
  - Justificativa: é o valor exibido como “Estimated total” no Dawn e reflete descontos de carrinho.

### 7.3 Por que não exibimos 1x

Quando a regra não permite ao menos 2 parcelas respeitando o mínimo por parcela, **não renderizamos**.

- Alternativa considerada: exibir “1x de …” (pouco útil e polui o layout).
- Decisão: priorizar UX limpa e informativa.

### 7.4 Arredondamento

Exibimos o valor por parcela com **arredondamento para cima** quando existir resto (`modulo > 0`), para não subestimar o valor.

### 7.5 Limitações

- Regras são **informativas** e não refletem necessariamente o parcelamento real do checkout/gateway.
- `min_per_installment` é inteiro em unidades da moeda (sem centavos). Se precisar de precisão (ex.: R$ 9,90), considerar evolução futura.

---

## 8. Guia de QA (passo a passo)

### 8.1 Habilitar/desabilitar a funcionalidade

1. Abrir **Personalizar** → **Configurações do tema** (engrenagem).
2. Entrar em **Parcelamento**.
3. Alternar **Exibir informações de parcelamento**.

**Esperado:**
- Off → nenhum contexto exibe a mensagem.
- On → respeita os toggles por contexto.

### 8.2 Configurar máximo de parcelas

1. Em **Parcelamento**, definir **Quantidade máxima de parcelas** (ex.: 12).
2. Salvar.

### 8.3 Configurar mínimo por parcela

1. Definir **Valor mínimo por parcela** (ex.: 10 para R$ 10,00).
2. Salvar.

### 8.4 Validar no card de produto (vitrine)

1. Ir para uma coleção/home com cards.
2. Verificar se aparece “Em até Nx de R$ … sem juros”.

**Cenários:**
- Produto barato (ex.: R$ 25, min=10, max=12):
  - `floor(25/10)=2` → **2x**.
- Produto caro (ex.: R$ 240, min=10, max=12):
  - `floor(240/10)=24` → cap em **12x**.
- Produto que não permite 2x (ex.: R$ 15, min=10):
  - `floor(15/10)=1` → **não exibe**.

### 8.5 Validar na PDP (página de produto)

1. Abrir um produto.
2. Confirmar que a mensagem aparece perto do preço.

**Troca de variante:**
- Trocar variante para uma com preço diferente.
- **Esperado:** a mensagem deve atualizar junto com o preço (sem recarregar a página inteira).

### 8.6 Validar no carrinho (página)

1. Adicionar itens ao carrinho.
2. Ir ao carrinho.
3. Validar a exibição abaixo do “Estimated total”.

**Esperado:** base é `cart.total_price` (com descontos aplicados).

### 8.7 Validar no cart drawer

1. Configurar o carrinho como “Deslizante”.
2. Adicionar item e abrir o drawer.
3. Validar a exibição abaixo do total do drawer.

### 8.8 Validar template de mensagem

1. Em **Parcelamento**, editar **Modelo da mensagem**.
2. Usar placeholders:
   - `{{ count }}`
   - `{{ amount }}`
3. Salvar e validar nos contextos.

**Esperado:** placeholders substituídos corretamente; valor formatado com `money`.

### 8.9 Responsividade

1. Simular mobile (≤ 749px).
2. Verificar que:
   - texto quebra linha sem overflow
   - não quebra o grid do card
   - não bagunça a hierarquia da PDP
   - não desalinha o total do carrinho

### 8.10 Edge cases

- `installment_max_count` <= 1 → não deve exibir (porque `count < 2`).
- `installment_min_per_installment` <= 0 → o snippet considera como “sem mínimo” e usa `max_count` (ainda exige `count >= 2`).
- Carrinho vazio → não exibe (base = 0).

---

## 9. Resumo final

Entregue:

- Feature de **parcelamento informativo** com regras configuráveis e cálculo centralizado.
- Exibição em **card**, **PDP**, **total do carrinho** (página + drawer).
- Estilo consistente com Dawn e documentação completa.

Pontos de atenção:

- É uma **mensagem informativa** (não é contrato de pagamento).
- Se a política real de parcelamento variar por método de pagamento/checkout, considerar integrar via app/metafields ou refletir essa regra no copy.

