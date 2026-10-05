const CART_STORAGE_KEY = 'tiemlen-cart';
export function loadCart(products, storage = globalThis.localStorage) {
  const cart = {};
  try {
    const saved = JSON.parse(storage?.getItem(CART_STORAGE_KEY) || '{}');
    for (const product of products) {
      const quantity = saved?.[product.id];
      if (Number.isInteger(quantity) && quantity > 0 && quantity <= 99) cart[product.id] = quantity;
    }
  } catch {
    /* Vẫn dùng được giỏ hàng khi trình duyệt chặn storage hoặc dữ liệu cũ bị hỏng. */
  }
  return cart;
}
export function saveCart(cart, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* Không ngắt thao tác mua hàng nếu localStorage không khả dụng. */
  }
}
