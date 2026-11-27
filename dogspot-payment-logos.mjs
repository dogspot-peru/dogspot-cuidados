// The same original brand files used by Mystigo; sources are kept alongside them.
export const paymentLogoFiles = Object.freeze({
  Yape: 'payment-logo-yape.webp',
  Plin: 'payment-logo-plin.png',
  BCP: 'payment-logo-bcp.svg',
  Interbank: 'payment-logo-interbank.png',
  BBVA: 'payment-logo-bbva.svg',
  Scotiabank: 'payment-logo-scotiabank.svg',
});

export function renderPaymentLogo(React, method, {compact = false, decorative = false} = {}) {
  const file = Object.hasOwn(paymentLogoFiles, method) ? paymentLogoFiles[method] : null;
  if (!file) return null;
  return React.createElement('span', {
    className: `dogspot-payment-logo${compact ? ' dogspot-payment-logo--compact' : ''}`,
    'data-payment-method': method,
  }, React.createElement('img', {
    src: new URL(file, import.meta.url).href,
    alt: decorative ? '' : `Logo de ${method}`,
    width: 96,
    height: 48,
    decoding: 'async',
    draggable: false,
  }));
}
