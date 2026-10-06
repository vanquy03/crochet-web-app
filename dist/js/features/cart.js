import { products } from '../data/products.js';
import { $, formatMoney, showToast } from '../utils/dom.js';
import { loadCart, saveCart } from '../utils/storage.js';
import { shop, backendAvailable } from '../config/shop.js';
import { customer, loginRequired, rememberCartAction } from '../services/customer.js';
import { safeProduct } from '../utils/html.js';
export const cartItems = {};
export function restoreCart() {
  Object.assign(cartItems, loadCart(products));
}
export function renderCart() {
  for (const id of Object.keys(cartItems))
    if (!products.some((p) => p.id === Number(id))) delete cartItems[id];
  saveCart(cartItems);
  $('count').textContent = Object.values(cartItems).reduce((a, b) => a + b, 0);
  $('cartItems').innerHTML =
    products
      .filter((p) => cartItems[p.id])
      .map((product) => {
        const p = safeProduct(product);
        return /* HTML */ `<div class="cartrow">
          <div>
            ${p.name}
            <p class="help">${formatMoney(p.price)} / sản phẩm</p>
          </div>
          <div class="qty">
            <button data-change="${p.id}" data-delta="-1" aria-label="Giảm số lượng ${p.name}">
              −</button
            ><span>${cartItems[p.id]}</span
            ><button data-change="${p.id}" data-delta="1" aria-label="Tăng số lượng ${p.name}">
              +</button
            ><button data-remove="${p.id}" aria-label="Xóa ${p.name}">×</button>
          </div>
        </div>`;
      })
      .join('') || '<p class="help">Giỏ hàng còn trống. Chọn một cuộn len bạn thích nhé.</p>';
  $('total').textContent = formatMoney(
    products.reduce((s, p) => s + p.price * (cartItems[p.id] || 0), 0),
  );
  if ($('submitOrder'))
    $('submitOrder').disabled = !backendAvailable || !Object.keys(cartItems).length;
  if ($('cartAvailability'))
    $('cartAvailability').textContent = !backendAvailable
      ? 'Chưa kết nối được cửa hàng. Vui lòng tải lại trang để đặt hàng.'
      : !Object.keys(cartItems).length
        ? 'Thêm ít nhất một sản phẩm còn hàng vào giỏ để đặt hàng.'
        : '';
  const subtotal = products.reduce((sum, p) => sum + p.price * (cartItems[p.id] || 0), 0);
  const shipping =
    Object.keys(cartItems).length > 0 &&
    !(shop.freeShippingThreshold > 0 && subtotal >= shop.freeShippingThreshold)
      ? shop.shippingFee
      : 0;
  if ($('shippingTotal')) $('shippingTotal').textContent = formatMoney(shipping);
  if ($('grandTotal')) $('grandTotal').textContent = formatMoney(subtotal + shipping);
  $('copy').disabled = $('download').disabled = !Object.keys(cartItems).length;
  document
    .querySelectorAll('[data-order-channel]')
    .forEach((b) => (b.disabled = !Object.keys(cartItems).length));
}
export function addToCart(id, n = 1, checkout = false) {
  if (!products.some((product) => product.id === Number(id)) || !Number.isInteger(n) || n < 1)
    return;
  const old = cartItems[id] || 0;
  const product = products.find((p) => p.id === Number(id));
  const maximum = backendAvailable ? Math.min(99, product.stock) : 99;
  if (maximum === 0) return showToast('Sản phẩm đã hết hàng.');
  if (!customer) {
    rememberCartAction(Number(id), Math.min(99, n), checkout);
    return false;
  }
  cartItems[id] = Math.min(maximum, old + n);
  renderCart();
  showToast(
    old + n > maximum ? `Chỉ có thể chọn ${maximum} sản phẩm này.` : 'Đã thêm vào giỏ len ♡',
  );
  return true;
}

export function initCart() {
  restoreCart();
  $('openCart').onclick = () => {
    if (!loginRequired('/?cart=1')) $('cart').showModal();
  };
  $('closeCart').onclick = () => $('cart').close();
  $('cartItems').onclick = (event) => {
    const removeButton = event.target.closest('[data-remove]');
    if (removeButton) {
      delete cartItems[removeButton.dataset.remove];
      renderCart();
      return;
    }
    const quantityButton = event.target.closest('[data-change]');
    if (!quantityButton) return;
    const id = quantityButton.dataset.change;
    const product = products.find((p) => p.id === Number(id));
    cartItems[id] = Math.min(
      backendAvailable ? Math.min(99, product.stock) : 99,
      (cartItems[id] || 0) + Number(quantityButton.dataset.delta),
    );
    if (cartItems[id] <= 0) delete cartItems[id];
    renderCart();
  };
  renderCart();
  let intent = null;
  try {
    if (customer) {
      intent = JSON.parse(sessionStorage.getItem('tiemlen-cart-intent') || 'null');
      sessionStorage.removeItem('tiemlen-cart-intent');
    }
  } catch {
    /* Tiếp tục dùng giỏ hàng khi storage không khả dụng. */
  }
  if (
    intent &&
    Number.isSafeInteger(intent.productId) &&
    Number.isInteger(intent.quantity) &&
    intent.quantity >= 1 &&
    intent.quantity <= 99
  )
    addToCart(intent.productId, intent.quantity);
  if (
    customer &&
    (intent || new URLSearchParams(globalThis.location?.search || '').get('cart') === '1')
  )
    $('cart').showModal();
}
