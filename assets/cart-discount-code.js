/**
 * Feature: Cart Discount Code
 * Description: Applies/removes discount codes via POST /cart/update.js and refreshes cart sections (Dawn-compatible).
 */

(function () {
  /** Cupom/código aplicado — só verdadeiro com código real (evita objeto vazio em discount_codes) */
  function cartHasDiscountCodeApplied(cart) {
    if (!cart || typeof cart !== 'object') return false;
    if (Array.isArray(cart.discount_codes) && cart.discount_codes.length > 0) {
      const hasRealCode = cart.discount_codes.some((d) => {
        if (typeof d === 'string') return d.trim().length > 0;
        if (d && typeof d === 'object') {
          const code = d.code != null ? String(d.code).trim() : '';
          if (code.length > 0) return d.applicable !== false;
          return false;
        }
        return false;
      });
      if (hasRealCode) return true;
    }
    if (Array.isArray(cart.cart_level_discount_applications)) {
      for (let i = 0; i < cart.cart_level_discount_applications.length; i++) {
        if (cart.cart_level_discount_applications[i].type === 'discount_code') return true;
      }
    }
    if (Array.isArray(cart.items)) {
      for (let i = 0; i < cart.items.length; i++) {
        const allocations = cart.items[i].line_level_discount_allocations;
        if (!Array.isArray(allocations)) continue;
        for (let j = 0; j < allocations.length; j++) {
          const app = allocations[j].discount_application;
          if (app && app.type === 'discount_code') return true;
        }
      }
    }
    return false;
  }

  function cartHasDiscountEvidence(cart) {
    if (!cart || typeof cart !== 'object') return false;
    const totalDiscount = Number(cart.total_discount);
    if (!Number.isNaN(totalDiscount) && totalDiscount > 0) return true;
    if (
      Array.isArray(cart.cart_level_discount_applications) &&
      cart.cart_level_discount_applications.length > 0
    )
      return true;
    if (Array.isArray(cart.items)) {
      for (let i = 0; i < cart.items.length; i++) {
        const allocations = cart.items[i].line_level_discount_allocations;
        if (Array.isArray(allocations) && allocations.length > 0) return true;
      }
    }
    if (Array.isArray(cart.discount_codes) && cart.discount_codes.length > 0) {
      return cart.discount_codes.some((d) => d.applicable !== false);
    }
    return false;
  }

  function formatSuccess(template, code) {
    if (!template) return '';
    return template.replace(/\{\{\s*code\s*\}\}/gi, code);
  }

  const FEEDBACK_KEY = 'cartDiscountCodeFeedback';

  class CartDiscountCode extends HTMLElement {
    connectedCallback() {
      this.applyBtn = this.querySelector('[data-cart-discount-apply]');
      this.removeBtn = this.querySelector('[data-cart-discount-remove]');
      this.input = this.querySelector('[data-cart-discount-input]');
      this.feedback = this.querySelector('[data-cart-discount-feedback]');

      this.applyBtn?.addEventListener('click', () => this.onApply());
      this.removeBtn?.addEventListener('click', () => this.onRemove());
      this.input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.onApply();
        }
      });

      const pending = sessionStorage.getItem(FEEDBACK_KEY);
      if (pending) {
        try {
          const parsed = JSON.parse(pending);
          if (parsed.kind === 'success' && parsed.code) {
            this.showSuccess(parsed.code);
          }
        } catch (e) {
          /* ignore */
        }
        setTimeout(() => sessionStorage.removeItem(FEEDBACK_KEY), 0);
      }

      this.syncRemoveButtonWithCart();
    }
    syncRemoveButtonWithCart() {
      if (!this.removeBtn || typeof routes === 'undefined' || !routes.cart_url) return;
      const url = `${routes.cart_url.split('?')[0]}.js`;
      fetch(url)
        .then((r) => r.json())
        .then((cart) => {
          this.removeBtn.hidden = !cartHasDiscountCodeApplied(cart);
        })
        .catch(() => {});
    }

    setApplyLoading(isLoading) {
      if (!this.applyBtn) return;
      const applying = (this.dataset.applyingLabel || '').trim();
      this.applyBtn.disabled = isLoading;
      this.applyBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      this.applyBtn.classList.toggle('cart-discount-code__apply--loading', isLoading);
      if (isLoading && applying) {
        this.applyBtn.setAttribute('aria-label', applying);
      } else {
        this.applyBtn.removeAttribute('aria-label');
      }
      if (this.input) this.input.disabled = isLoading;
      if (this.removeBtn) this.removeBtn.disabled = isLoading;
    }

    setRemoveLoading(isLoading) {
      if (this.removeBtn) {
        this.removeBtn.disabled = isLoading;
        this.removeBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        this.removeBtn.classList.toggle('cart-discount-code__remove--loading', isLoading);
      }
      if (this.input) this.input.disabled = isLoading;
      if (this.applyBtn) this.applyBtn.disabled = isLoading;
    }

    clearFeedback() {
      if (!this.feedback) return;
      this.feedback.textContent = '';
      this.feedback.classList.add('visually-hidden');
      this.feedback.removeAttribute('role');
    }

    showSuccess(code) {
      if (!this.feedback) return;
      const tpl = this.dataset.successTemplate || '';
      const msg = formatSuccess(tpl, code);
      this.feedback.textContent = msg;
      this.feedback.classList.remove('visually-hidden', 'cart-discount-code__feedback--error');
      this.feedback.classList.add('cart-discount-code__feedback--success');
      this.feedback.setAttribute('role', 'status');
      this.feedback.focus({ preventScroll: true });
    }

    showError(message) {
      if (!this.feedback) return;
      this.feedback.textContent = message || this.dataset.errorMessage || '';
      this.feedback.classList.remove('visually-hidden');
      this.feedback.classList.add('cart-discount-code__feedback--error');
      this.feedback.classList.remove('cart-discount-code__feedback--success');
      this.feedback.setAttribute('role', 'alert');
      this.feedback.focus({ preventScroll: true });
    }

    async onApply() {
      const code = (this.input?.value || '').trim();
      if (!code) {
        this.showError(this.dataset.emptyMessage || '');
        return;
      }

      this.clearFeedback();
      this.setApplyLoading(true);
      try {
        const response = await fetch(`${routes.cart_update_url}`, {
          ...fetchConfig(),
          body: JSON.stringify({ discount: code }),
        });
        const data = await response.json();

        if (!response.ok) {
          const err =
            data.description || data.message || this.dataset.errorMessage || '';
          this.showError(err);
          return;
        }

        if (!cartHasDiscountEvidence(data)) {
          this.showError(this.dataset.errorMessage || '');
          return;
        }

        this.showSuccess(code);
        if (this.input) this.input.value = '';
        if (this.removeBtn) this.removeBtn.hidden = !cartHasDiscountCodeApplied(data);
        sessionStorage.setItem(FEEDBACK_KEY, JSON.stringify({ kind: 'success', code }));
        await this.refreshCartUI(data);
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-discount-code', cartData: data });
      } catch (e) {
        console.error(e);
        this.showError(this.dataset.errorMessage || '');
      } finally {
        this.setApplyLoading(false);
      }
    }

    async onRemove() {
      this.clearFeedback();
      this.setRemoveLoading(true);
      try {
        const response = await fetch(`${routes.cart_update_url}`, {
          ...fetchConfig(),
          body: JSON.stringify({ discount: '' }),
        });
        const data = await response.json();

        if (!response.ok) {
          const err =
            data.description || data.message || this.dataset.errorMessage || '';
          this.showError(err);
          return;
        }

        if (this.removeBtn) this.removeBtn.hidden = true;
        await this.refreshCartUI(data);
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-discount-code', cartData: data });
      } catch (e) {
        console.error(e);
        this.showError(this.dataset.errorMessage || '');
      } finally {
        this.setRemoveLoading(false);
      }
    }

    async refreshCartUI(cartData) {
      const tasks = [];

      if (document.querySelector('cart-items')) {
        tasks.push(
          fetch(`${routes.cart_url}?section_id=main-cart-items`)
            .then((r) => r.text())
            .then((html) => {
              const doc = new DOMParser().parseFromString(html, 'text/html');
              const source = doc.querySelector('cart-items');
              const target = document.querySelector('cart-items');
              if (source && target) target.innerHTML = source.innerHTML;
            })
        );
      }

      if (document.getElementById('main-cart-footer')) {
        tasks.push(
          fetch(`${routes.cart_url}?section_id=main-cart-footer`)
            .then((r) => r.text())
            .then((html) => {
              const doc = new DOMParser().parseFromString(html, 'text/html');
              const source = doc.querySelector('#main-cart-footer');
              const target = document.querySelector('#main-cart-footer');
              if (source && target) target.innerHTML = source.innerHTML;
            })
        );
      }

      if (document.querySelector('cart-drawer')) {
        tasks.push(
          fetch(`${routes.cart_url}?section_id=cart-drawer`)
            .then((r) => r.text())
            .then((html) => {
              const doc = new DOMParser().parseFromString(html, 'text/html');
              ['cart-drawer-items', '.cart-drawer__footer'].forEach((selector) => {
                const sourceElement = doc.querySelector(selector);
                const targetElement = document.querySelector(selector);
                if (sourceElement && targetElement) targetElement.replaceWith(sourceElement);
              });
            })
        );
      }

      await Promise.all(tasks);

      const empty = !cartData || !cartData.item_count;
      document.querySelector('cart-items')?.classList.toggle('is-empty', empty);
      const cartFooter = document.getElementById('main-cart-footer');
      if (cartFooter) cartFooter.classList.toggle('is-empty', empty);
      const drawer = document.querySelector('cart-drawer');
      if (drawer) drawer.classList.toggle('is-empty', empty);
    }
  }

  if (!customElements.get('cart-discount-code')) {
    customElements.define('cart-discount-code', CartDiscountCode);
  }
})();
