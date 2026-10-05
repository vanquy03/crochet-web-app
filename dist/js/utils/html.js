export function escapeHTML(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}
export function safeProduct(product) {
  return {
    ...product,
    name: escapeHTML(product.name),
    desc: escapeHTML(product.desc),
    tag: escapeHTML(product.tag),
  };
}
