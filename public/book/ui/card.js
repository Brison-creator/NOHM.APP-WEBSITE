// Putting a card on file from the browser. The one place Stripe.js is
// touched. Same server steps as the app's add-card sheet:
//   POST /stripe/customer/setup-intent  → clientSecret
//   Stripe confirms the SetupIntent in the browser (card never touches NOHM)
//   POST /stripe/customer/confirm-card  → the server sees the card, sets hasPaymentMethod
//
// Stripe.js loads only when this screen is shown, never on page load.

let stripeLoad = null;

function loadStripeJs() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!stripeLoad) {
    stripeLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => resolve(window.Stripe);
      s.onerror = () => reject(new Error("Couldn't load the card form. Check your connection and try again."));
      document.head.appendChild(s);
    });
  }
  return stripeLoad;
}

/**
 * Mount Stripe's card element into `host`. Returns { confirm(), destroy() }.
 * `confirm()` creates the SetupIntent, confirms it with the card the
 * person typed, then tells the server. Resolves to { last4, brand }.
 */
export async function mountCardForm({ host, publishableKey, api, name }) {
  const Stripe = await loadStripeJs();
  const stripe = Stripe(publishableKey);
  const elements = stripe.elements({ fonts: [{ cssSrc: '/type.css' }] });
  const card = elements.create('card', {
    hidePostalCode: false,
    style: {
      base: { fontFamily: 'Manrope, Arial, sans-serif', fontSize: '16px', color: '#171a20', '::placeholder': { color: '#86868b' } },
      invalid: { color: '#b3261e' },
    },
  });
  card.mount(host);
  let complete = false;
  const listeners = [];
  card.on('change', (e) => {
    complete = Boolean(e.complete);
    listeners.forEach((fn) => fn({ complete, error: e.error ? e.error.message : null }));
  });

  return {
    onChange(fn) {
      listeners.push(fn);
    },
    get complete() {
      return complete;
    },
    async confirm() {
      const { clientSecret } = await api.stripe.setupIntent();
      const { error } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card, billing_details: name ? { name } : undefined },
      });
      if (error) throw new Error(error.message || 'That card was declined.');
      return api.stripe.confirmCard();
    },
    destroy() {
      card.destroy();
    },
  };
}
