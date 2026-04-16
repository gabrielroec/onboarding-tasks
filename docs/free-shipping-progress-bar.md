# Barra de progresso de frete grátis (Free Shipping Progress Bar)

## 1. Visão geral da funcionalidade

### O que foi implementado

- Bloco na **página do carrinho** (template `cart`) que mostra:
  - um **título** configurável (ou texto padrão de tradução);
  - uma **mensagem dinâmica** com o valor restante formatado em moeda, ou a mensagem de sucesso quando a meta é atingida;
  - uma **barra de progresso** visual (largura = percentual do subtotal em relação ao mínimo, limitado a 100%).
- Tudo configurável no **Theme Editor** em **Configurações do tema → Carrinho** (grupo **Free shipping progress bar**).
- **Sem JavaScript**: cálculo e renderização feitos em Liquid; ao atualizar quantidades no carrinho, o Dawn refaz o fetch das seções e o progresso atualiza sozinho.

### Objetivo da solução

Incentivar o aumento do valor do pedido com feedback claro e honesto, usando **dados reais do carrinho** e **formatação monetária** da Shopify (`| money`), sem simular valores no front.

---

## 2. Arquitetura da solução

### Onde foi encaixada

| Local | Motivo |
|-------|--------|
| `sections/main-cart-footer.liquid` | A seção `main-cart-footer` é a do rodapé do carrinho na página dedicada; concentra totais e checkout. A barra fica **acima** de `cart__blocks` (subtotal/botões), após a nota do pedido (se existir), integrando-se ao fluxo visual do resumo. |
| `snippets/cart-free-shipping-progress.liquid` | Componente isolado, fácil de localizar e manter. |
| `assets/component-free-shipping-progress.css` | Estilos escopados ao componente; carregados só quando a funcionalidade está ativa. |
| `config/settings_schema.json` | Configurações globais no grupo **Cart**, padrão Dawn para opções que afetam o comportamento do carrinho. |


### Base de cálculo (objeto `cart`)

| Propriedade | Uso |
|-------------|-----|
| `cart.items_subtotal_price` | **Subtotal dos itens** (após descontos em linha), na menor unidade da moeda (ex.: centavos). É o valor usado para medir o progresso. |

**Justificativa:** regras do tipo “gaste X para frete grátis” costumam referir-se ao **valor dos produtos (subtotal)**, alinhado ao que o cliente percebe ao somar os itens. `cart.total_price` inclui descontos em nível de carrinho e pode distorcer a meta; por isso **não** foi usado como base principal. Se a loja precisar usar o total final, isso deve ser tratado como mudança de regra de negócio documentada.

### Valor mínimo configurável

- O lojista informa um **número inteiro** na **moeda da loja** (ex.: `199` para R$ 199,00).
- No Liquid: `threshold_cents = settings.free_shipping_minimum | times: 100` para comparar com `items_subtotal_price` (também em menor unidade).

**Limitação:** em moedas sem centavos (ex.: alguns usos de JPY), a convenção da Shopify para menor unidade pode diferir; lojas nesses casos devem validar o valor na vitrine real.

---

## 3. Arquivos criados e alterados

### Criados

| Arquivo | Função |
|---------|--------|
| `snippets/cart-free-shipping-progress.liquid` | Lógica Liquid: limiar, percentual (cap 100%), mensagens, marcação acessível. |
| `assets/component-free-shipping-progress.css` | Layout responsivo, trilha da barra, estado “completo”, variáveis de cor Dawn. |
| `docs/free-shipping-progress-bar.md` | Esta documentação. |

### Alterados

| Arquivo | Alteração |
|---------|-----------|
| `config/settings_schema.json` | Novas opções no grupo Cart: ativar barra, valor mínimo, título, textos antes/depois da meta. |
| `sections/main-cart-footer.liquid` | Comentários de feature; include condicional do CSS; `render` do snippet com `section_id`. |
| `sections/main-cart-items.liquid` | Comentário de rastreabilidade (a barra não renderiza nesta seção). |
| `locales/en.default.json` | Chaves `sections.cart.free_shipping.*` (fallbacks de tradução). |
| `locales/pt-BR.json` | Idem em pt-BR. |
| `locales/en.default.schema.json` | Rótulos/info do schema em inglês. |
| `locales/pt-BR.schema.json` | Rótulos/info do schema em pt-BR. |
| Demais `locales/*.json` | Chaves `free_shipping` para consistência do theme check. |
| Demais `locales/*.schema.json` | Bloco `free_shipping` nos schemas traduzidos. |

---

## 4. Como os arquivos conversam entre si

1. **Theme Editor** grava valores em `settings` (ex.: `enable_free_shipping_progress`, `free_shipping_minimum`, textos).
2. **`main-cart-footer.liquid`** inclui o CSS se a opção estiver ativa e renderiza o **snippet**, passando `section.id` para IDs estáveis em ARIA.
3. O **snippet** lê `cart.items_subtotal_price` e `settings`, calcula percentual e mensagens, aplica `| money` ao valor restante e `| escape` ao texto exibido.
4. **`component-free-shipping-progress.css`** estiliza a região, a mensagem e a barra sem depender de JS.
5. Quando o cliente altera quantidades, **`cart.js`** do Dawn atualiza as seções do carrinho; o HTML do footer é substituído e o progresso é recalculado no servidor.

---

## 5. Conceitos técnicos

| Tópico | Uso |
|--------|-----|
| **Liquid** | Condicionais, `assign`, `divided_by`, comparação de inteiros, `replace` para `{{ amount }}` nas mensagens customizadas. |
| **Schema / settings** | Campos no `settings_schema.json` expostos em **Configurações do tema → Carrinho**. |
| **Traduções** | `sections.cart.free_shipping.*` com `t` e parâmetro `amount` já formatado. |
| **Formatação monetária** | `remaining_cents \| money` (e filtros padrão da loja). |
| **Percentual** | `(current_cents * 100) / threshold_cents`, limitado a 100 na UI. |
| **Responsividade** | `max-width: 100%`, tipografia e padding reduzidos em mobile (`max-width: 749px`). |
| **Acessibilidade** | `role="region"`, título com `aria-labelledby`, barra com `role="progressbar"` e `aria-valuenow` / `aria-valuemax` / `aria-valuemin`, `aria-describedby` ligado à mensagem quando a meta não foi atingida. |
| **JavaScript** | Não utilizado nesta feature. |

---

## 6. Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| **`items_subtotal_price` como base** | Alinhado a metas do tipo “valor do pedido em produtos”; documentado para revisão. |
| **Configuração no grupo Cart** | Mesmo padrão de outras opções globais do carrinho; um só lugar para o lojista. |
| **Página do carrinho + cart drawer** | Incentivo aparece tanto no carrinho (página) quanto no drawer; reaproveita o mesmo snippet e as mesmas configurações globais. |
| **Mensagens com placeholder `{{ amount }}`** | Permite personalizar copy mantendo o valor formatado pela Shopify. |
| **Sem JS** | O carrinho Dawn já re-renderiza seções após mudança de quantidade; o progresso permanece correto. |

### Alternativas consideradas

- Usar `cart.total_price`: possível para lojas cuja regra seja “total após descontos”; exigiria alinhamento explícito com regras de frete no admin.
- Bloco na seção `main-cart-footer` com schema próprio: mais flexível por instância de seção, porém mais pesado para um único componente.

### Limitações

- No `settings_schema.json`, o tipo `number` **não** aceita `min`, `max` ou `step` (Theme Check `ValidJSON`); o limiar é um número livre — valores ≤ 0 são ignorados no Liquid (`minimum_units > 0`).
- O valor mínimo é um **inteiro em unidades da moeda**; valores como “R$ 99,90” exigem arredondamento (ex.: 100) ou evolução futura com campo decimal se a plataforma permitir.
- A barra **não** integra regras reais de envio do Shopify Shipping; é **informativa** conforme o limiar configurado pelo lojista.
- O drawer atualiza via renderização de seções do Dawn; a barra acompanha essas atualizações sem JS adicional (mesma lógica do carrinho de página).

---

## 7. Guia de QA

### Habilitar / desabilitar

1. Na loja: **Loja online** → **Temas** → **Personalizar** no tema em uso (ou abrir o link **Customize your theme** do `shopify theme dev`).
2. Abrir **Configurações do tema** (ícone de **engrenagem** no painel esquerdo ou inferior — **não** é o nome da secção “Carrinho” ao editar o modelo da página).
3. No menu das definições globais, escolher **Carrinho** / **Cart**.
4. Fazer scroll: as opções da barra ficam **entre** “Observação do carrinho” e o bloco **“Carrinho de compras deslizante”** (cabeçalho **Barra de progresso de frete grátis** em PT-BR).
5. Localizar **Exibir barra de progresso de frete grátis** / **Show free shipping progress bar**.
6. Marcar ou desmarcar e **Salvar**.

Se não aparecer o cabeçalho “Barra de progresso de frete grátis”, confirma que o ficheiro `config/settings_schema.json` do projeto está sincronizado com a loja (ex.: `shopify theme dev` ativo) e recarrega o personalizador.

### Configurar o valor mínimo

1. No mesmo grupo, editar **Minimum order amount** / **Valor mínimo do pedido** (ex.: `150` para R$ 150,00 em loja BRL).
2. Salvar e abrir o carrinho com produtos.

### Carrinho abaixo do valor

- Adicionar itens cujo subtotal seja **menor** que o mínimo.
- **Esperado:** mensagem do tipo “Faltam R$ X…” (ou texto customizado com `{{ amount }}`), barra com largura &lt; 100%, sem classe de conclusão.

### Carrinho exatamente no valor

- Ajustar quantidades para o subtotal **igual** ao limiar (na prática, pode exigir combinação exata de preços).
- **Esperado:** mensagem de sucesso, barra a 100%, estado visual “completo”.

### Carrinho acima do valor

- Subtotal **superior** ao mínimo.
- **Esperado:** mensagem de sucesso, barra em 100% (percentual limitado no Liquid).

### Validar mensagens

- Textos padrão: vêm dos **locales** se os campos de mensagem no tema estiverem vazios (ou usar defaults do schema conforme salvos).
- Mensagens customizadas: editar os campos de texto no grupo e verificar substituição de `{{ amount }}`.

### Validar a barra

- Inspecionar a `div.free-shipping-progress__fill`: `style="width: N%;"` com N entre 0 e 100.

### Mobile

- Redimensionar ou usar DevTools; texto deve quebrar linha sem overflow horizontal; padding reduzido conforme CSS.

### Edge cases

| Cenário | Esperado |
|---------|----------|
| Carrinho vazio | Snippet não renderiza (`cart == empty`). |
| Valor mínimo = 0 ou desativado | Snippet não renderiza (`minimum_units > 0` e enable). |
| Desconto em linha reduz subtotal | Progresso baseado no **subtotal já descontado em linha** (comportamento de `items_subtotal_price`). |

---

## 8. Resumo final

### Entregue

- Barra de progresso e mensagens na **página do carrinho**, configuráveis no Theme Editor, **100% Liquid + CSS**, dados reais do carrinho e formatação monetária nativa.
- Documentação e comentários de rastreabilidade nos pontos de integração.

### Pontos de atenção

- Alinhar o valor mínimo do tema com a **política real de frete grátis** da loja (envio/checkout).
- Validar em **moeda e mercado** reais (BRL, USD, etc.).
- Inclusão futura no **cart drawer** é possível reutilizando o mesmo snippet, se desejado.
