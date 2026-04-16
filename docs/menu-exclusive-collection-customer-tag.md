# Navegação exclusiva no menu por tag de cliente (Dawn)

## 1. Visão geral

### O que foi implementado

Foi adicionada uma opção na secção **Header** do editor de temas que permite:

- Ativar ou desativar um **link extra** no menu principal de navegação.
- O link só é renderizado quando existe **cliente autenticado** e esse cliente possui uma **tag** configurada na loja (comparação robusta, ver secção 7).
- O destino do link é sempre uma **coleção** escolhida no personalizador (tipo de setting `collection` do Shopify), com texto do link configurável.

### Objetivo

Permitir que a loja mostre, por exemplo, “Coleção Funcionários” apenas a clientes com a tag `Funcionário`, sem alterar o menu principal na navegação da Shopify Admin e sem JavaScript: **tudo avaliado no servidor**, no HTML enviado ao browser, evitando “piscar” ou itens que aparecem e desaparecem após o carregamento.

---

## 2. Regra de negócio

### Condições que têm de ser verdadeiras (todas)

1. A opção **“Ativar link de navegação exclusivo”** está marcada.
2. O campo **Tag do cliente** não está vazio (após remover espaços no início e no fim).
3. O campo **Texto do link no menu** não está vazio (após `strip`).
4. Foi selecionada uma **Coleção** válida no personalizador.
5. Existe **cliente autenticado** (`customer` definido no Liquid).
6. Pelo menos uma tag do cliente, normalizada da mesma forma que a tag configurada, **é igual** à tag configurada (ver comparação na secção 7).

### Comportamento por cenário

| Cenário | Link no menu |
|--------|----------------|
| Visitante não autenticado | **Não** aparece |
| Cliente autenticado sem nenhuma tag | **Não** aparece |
| Cliente autenticado com tags, mas nenhuma coincide com a configurada | **Não** aparece |
| Cliente autenticado com a tag correta (após normalização) | **Aparece** |
| Funcionalidade desativada ou campos obrigatórios em falta | **Não** aparece |

---

## 3. Arquitetura da solução

### Onde a feature se encaixa no Dawn

O Dawn renderiza o menu principal em três sítios, consoante o tipo de menu e o viewport:

1. **Desktop — dropdown:** `snippets/header-dropdown-menu.liquid` → `<nav class="header__inline-menu">` → `<ul class="list-menu list-menu--inline">`.
2. **Desktop — mega menu:** `snippets/header-mega-menu.liquid` → mesma estrutura de lista inline.
3. **Drawer (hamburger):** `snippets/header-drawer.liquid` → `<ul class="menu-drawer__menu has-submenu list-menu">` (usado em mobile e também em desktop se “Menu type” = Drawer).

A secção `sections/header.liquid` escolhe entre dropdown, mega ou drawer e inclui sempre o drawer quando há menu configurado; os snippets recebem o mesmo objeto `section` (header).

### Injeção do item

Em cada um dos três ficheiros, **após** o `{% for link in section.settings.menu.links %}` (ou seja, **depois** de todos os itens do link list da Admin), foi acrescentado um `render` ao snippet dedicado:

- Desktop (dropdown e mega): `{% render 'header-customer-tag-exclusive-nav-item', layout: 'inline' %}`.
- Drawer: `{% render 'header-customer-tag-exclusive-nav-item', layout: 'drawer' %}`.

Assim o item extra **sempre** fica no **fim** da lista de links do menu principal, mantendo o loop original do Dawn intacto.

### Lógica

Toda a condição e o markup do link extra estão em **`snippets/header-customer-tag-exclusive-nav-item.liquid`**, com comentário de identificação da feature. Não há JavaScript: o Shopify envia HTML já correto para o estado de sessão atual.

---

## 4. Ficheiros criados e alterados

| Ficheiro | Função |
|----------|--------|
| `snippets/header-customer-tag-exclusive-nav-item.liquid` | **Novo.** Calcula se o link deve aparecer; emite um `<li>` com `<a>` e classes Dawn (`inline` ou `drawer`). |
| `sections/header.liquid` | **Alterado.** Novos settings no schema (checkbox, textos, coleção) e cabeçalhos/parágrafo no personalizador. |
| `snippets/header-dropdown-menu.liquid` | **Alterado.** Comentário da feature + `render` após o loop do menu. |
| `snippets/header-mega-menu.liquid` | **Alterado.** Idem. |
| `snippets/header-drawer.liquid` | **Alterado.** Idem com `layout: 'drawer'`. |
| `locales/en.default.schema.json` | **Alterado.** Chaves `t:` para os novos settings da secção Header. |
| `locales/pt-BR.schema.json` | **Alterado.** Traduções PT-BR das mesmas chaves. |
| `locales/*.schema.json` (restantes) | **Alterado.** Mesmas chaves com texto em inglês (fallback para revisores / theme check). |
| `docs/menu-exclusive-collection-customer-tag.md` | **Novo.** Esta documentação. |

---

## 5. Como os ficheiros “conversam”

1. O lojista define valores na secção **Header** (grupo de secções do tema) — armazenados como `section.settings.*` na instância da secção header.
2. O Liquid dos snippets de menu faz o loop sobre `section.settings.menu.links` (menu da Admin).
3. O snippet `header-customer-tag-exclusive-nav-item.liquid` lê os mesmos `section.settings` e o objeto global **`customer`**.
4. Se todas as condições forem satisfeitas, o snippet imprime um `<li>` extra com `href="{{ exclusive_collection.url }}"`.
5. Desktop usa `layout: 'inline'` (classes iguais aos links simples do menu); o drawer usa `layout: 'drawer'` (classes `menu-drawer__menu-item`, etc.).

Não há chamadas AJAX nem endpoints externos.

---

## 6. Conceitos técnicos

### Objeto `customer`

No Liquid do tema online, `customer` está disponível quando o visitante tem sessão de cliente na loja. Se não estiver logado, `customer` é “falso” em contextos `{% if customer %}`.

Referência: [Liquid objects: customer](https://shopify.dev/docs/api/liquid/objects/customer).

### Tags do cliente

`customer.tags` é uma lista de strings (tags associadas ao cliente na Admin). A visibilidade de conteúdo por tag **no tema** só é adequada para **personalização de UX** (mostrar link, mensagem, etc.); **não** substitui controlo de acesso a preços ou inventário: quem conhece o URL da coleção ainda pode tentar aceder (restrições reais exigem apps, Shopify Functions, ou bloqueio no checkout/carrinho).

### Condicional em Liquid

Usámos `{% liquid %}` para atribuições e um ciclo `for customer_tag in customer.tags` com comparação após normalização (ver abaixo).

### Header / menu Dawn

O menu principal vem de **Navigation / link list** (`section.settings.menu`). A feature **não** altera essa link list; apenas acrescenta um item **dinâmico** no fim da lista renderizada.

### Schema / settings

Settings adicionados à secção `header` com IDs:

- `exclusive_customer_tag_nav_enabled` (checkbox)
- `exclusive_customer_tag_nav_tag` (text)
- `exclusive_customer_tag_nav_title` (text)
- `exclusive_customer_tag_nav_collection` (collection)

Labels e infos usam chaves `t:sections.header.settings.*` nos ficheiros `*.schema.json`.

### Renderização condicional e “sem piscar”

Como a decisão é feita no **servidor** ao renderizar a página, o HTML já chega sem o link quando não deve existir. Não há FOUC causado por JS a esconder o item.

### Desktop e mobile

- **Dropdown / Mega (desktop):** item no `header-inline-menu`.
- **Drawer:** o mesmo critério Liquid; o item aparece na lista do drawer (mobile e, se aplicável, desktop em modo drawer).

### Acessibilidade

- O link é um `<a>` real com `href` da coleção.
- `aria-current="page"` quando `request.path` coincide com `collection.url` (comportamento alinhado aos outros itens do menu).
- IDs estáveis: `HeaderMenu-exclusive-customer-tag-collection` e `HeaderDrawer-exclusive-customer-tag-collection`.
- Classes `focus-inset` e padrões de link do Dawn mantidos.

---

## 7. Decisões técnicas

### Por que Liquid (sem JS)

O critério de aceitação pedia frontend do tema com dados reais do cliente; o Shopify expõe `customer` no Liquid. JS não é necessário e prejudicaria acessibilidade percebida (flash de conteúdo).

### Por que coleção em vez de URL livre

- O setting **`collection`** no schema é nativo, validado no personalizador e devolve `collection.url` coerente com mercados/idiomas quando aplicável.
- URL manual ou link picker seriam alternativas; a coleção foi priorizada por **clareza de negócio** (“esta coleção é só para quem tem a tag X”).

### Onde o item foi colocado

No **fim** dos links do menu principal, para não interferir com a ordem definida na Admin e para revisão simples (“tudo o que vem do menu X + um bloco no fim”).

### Comparação da tag

Implementação:

1. Tag configurada: `strip` + `downcase`.
2. Cada `customer_tag`: `strip` + `downcase`.
3. Igualdade exata entre as duas strings normalizadas.

**Efeitos:**

- **Não** diferencia maiúsculas/minúsculas (`Funcionário` = `funcionário`).
- Remove espaços à esquerda/direita da tag configurada e de cada tag do cliente.
- **Não** normaliza espaços internos duplos; se a tag na Admin for `Funcionário  VIP` (dois espaços), a configuração tem de refletir isso após `strip` só nas pontas.

### Desktop e mobile

Mesma lógica em três pontos de renderização; duplicação mínima (apenas o parâmetro `layout` muda o markup/CSS classes).

### Alternativas consideradas

- **Só link list na Admin:** não permite condicional por cliente sem apps.
- **Metafield de cliente + app:** mais forte para autorização, fora do escopo “tema Dawn limpo”.
- **JS a ler `/customer`:** não existe endpoint público simples assim; seria frágil e com flicker.

### Limitações

1. **Segurança comercial:** ocultar o link não esconde a coleção de utilizadores que adivinhem o URL.
2. **Cache / CDN:** páginas muito agressivamente cacheadas para anónimos não afetam o HTML por sessão logada da mesma forma que páginas dinâmicas normais; em cenários raros de cache edge, validar com a infraestrutura da loja.
3. **Posição:** o item é sempre o último da lista renderizada; não há setting de “posição” para manter o personalizador simples.
4. **`request.path` vs `collection.url`:** devem alinhar para `aria-current`; em lojas com prefixos de mercado/idioma, o Shopify costuma alinhar `collection.url` com o contexto atual.

---

## 8. Guia de QA

### 8.1 Preparação na Admin Shopify

1. Criar ou escolher uma **coleção** (ex.: “Coleção Exclusiva Funcionário”).
2. Criar um **cliente de teste** com password (ou usar conta existente).
3. Na ficha do cliente, adicionar a **tag** exata que vai usar no teste (ex.: `Funcionário`).

### 8.2 Configurar no tema

1. **Personalizar tema** → secção **Header** (ou grupo que contém o header).
2. Localizar o bloco **“Exclusive navigation (customer tag)”** / **“Navegação exclusiva (tag de cliente)”** (tradução depende do locale do editor).
3. Marcar **Ativar link de navegação exclusivo**.
4. Preencher **Tag do cliente** (ex.: `Funcionário` — pode testar maiúsculas/minúsculas misturadas).
5. Preencher **Texto do link no menu** (ex.: “Área Funcionários”).
6. Escolher a **Coleção** de destino.
7. Guardar.

### 8.3 Casos de teste

| # | Passos | Resultado esperado |
|---|--------|---------------------|
| A | Logout, abrir loja (desktop), inspecionar menu / drawer | Link **não** aparece |
| B | Login com cliente **sem** a tag | Link **não** aparece |
| C | Login com cliente **com** a tag | Link **aparece** no fim do menu (desktop) e no drawer (abrir hamburger no mobile) |
| D | Desativar checkbox, guardar, cliente com tag | Link **não** aparece |
| E | Ativar mas apagar o texto da tag | Link **não** aparece |
| F | Ativar mas não escolher coleção | Link **não** aparece |
| G | Estar na página da coleção com o link visível | Link com estilo “ativo” / `aria-current="page"` coerente com outros itens |

### 8.4 Edge cases

- **Várias tags no cliente:** basta **uma** coincidir (após normalização).
- **Tag só com espaços:** tratada como vazio após `strip` → link não mostrado.
- **Menu desktop = Drawer:** o item só aparece no drawer também em desktop — comportamento esperado do Dawn.

---

## 9. Resumo final

### Entregue

- Settings no **Header** para ativar, tag, título e coleção.
- Snippet reutilizável com lógica e markup.
- Integração em **dropdown**, **mega menu** e **menu drawer** sem alterar o loop original dos links.
- Documentação e chaves de tradução de schema (EN + PT-BR + fallback EN nos outros locales).

### Pontos de atenção

- Tratar a feature como **UX**, não como controlo de acesso.
- Manter a tag na Admin alinhada com a configuração (normalização: case + trim nas pontas).
- Para alterações futuras, procurar pelo comentário **“Funcionalidade: menu exclusivo por tag de cliente”** (ou o bloco equivalente no snippet `header-customer-tag-exclusive-nav-item`) nos ficheiros tocados.
