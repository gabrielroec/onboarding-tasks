/*
  Funcionalidade: PDP Compre Junto
  Descrição: adiciona ao carrinho o item da PDP (variante selecionada) + a variante do produto recomendado via metacampo.

  Regras:
  - Variante principal: lida no clique a partir do formulário principal do produto (input [name="id"]).
  - Variante recomendada: fornecida via data-recommended-variant-id (Liquid valida “em estoque” antes de renderizar).
  - Integração Dawn: usa /cart/add com sections + sections_url e chama cart.renderContents(), publicando PUB_SUB_EVENTS.cartUpdate/cartError.
*/

if (!customElements.get('buy-together')) {
  customElements.define(
    'buy-together',
    class BuyTogether extends HTMLElement {
      constructor() {
        super();

        this.button = this.querySelector('button.buy-together__button');
        this.spinner = this.button?.querySelector('.loading__spinner');
        this.errorWrapper = this.querySelector('.product-form__error-message-wrapper');
        this.errorMessage = this.querySelector('.product-form__error-message');

        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');

        if (!this.button) return;
        this.button.addEventListener('click', this.onClick.bind(this));
      }

      onClick(evt) {
        evt.preventDefault();
        if (this.button.getAttribute('aria-disabled') === 'true') return;

        this.setError(false);
        this.setLoading(true);

        const recommendedVariantId = this.dataset.recommendedVariantId;
        const productFormId = this.dataset.productFormId;
        const form = productFormId ? document.getElementById(productFormId) : null;

        const mainVariantInput = form ? form.querySelector('[name="id"]') : null;
        const mainVariantId = mainVariantInput ? mainVariantInput.value : null;

        if (!mainVariantId || mainVariantInput?.disabled) {
          this.setError(this.dataset.errorGeneric);
          this.setLoading(false);
          return;
        }

        if (!recommendedVariantId) {
          this.setError(this.dataset.errorGeneric);
          this.setLoading(false);
          return;
        }

        let mainQty = 1;
        const qtyInput = form ? form.querySelector('[name="quantity"]') : null;
        if (qtyInput && qtyInput.value) {
          const parsed = parseInt(qtyInput.value, 10);
          if (!Number.isNaN(parsed) && parsed > 0) mainQty = parsed;
        }

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const body = new FormData();
        body.append('items[0][id]', mainVariantId);
        body.append('items[0][quantity]', String(mainQty));
        body.append('items[1][id]', recommendedVariantId);
        body.append('items[1][quantity]', '1');

        if (this.cart) {
          body.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          body.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }

        config.body = body;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
                publish(PUB_SUB_EVENTS.cartError, {
                  source: 'buy-together',
                  productVariantId: mainVariantId,
                  errors: response.errors || response.description,
                  message: response.message,
                });
              }
              this.setError(response.description || this.dataset.errorGeneric);
              return;
            }

            if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'buy-together',
                productVariantId: mainVariantId,
                cartData: response,
              }).then(() => {
                this.cart.renderContents(response);
                if (this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
              });
            } else {
              this.cart.renderContents(response);
              if (this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            }
          })
          .catch((e) => {
            console.error(e);
            this.setError(this.dataset.errorGeneric);
          })
          .finally(() => {
            this.setLoading(false);
          });
      }

      setLoading(isLoading) {
        if (isLoading) {
          this.button.setAttribute('aria-disabled', true);
          this.button.classList.add('loading');
          this.spinner?.classList.remove('hidden');
        } else {
          this.button.classList.remove('loading');
          this.button.removeAttribute('aria-disabled');
          this.spinner?.classList.add('hidden');
        }
      }

      setError(message) {
        if (!this.errorWrapper || !this.errorMessage) return;
        const shouldShow = Boolean(message);
        this.errorWrapper.toggleAttribute('hidden', !shouldShow);
        if (shouldShow) this.errorMessage.textContent = message;
      }
    }
  );
}

