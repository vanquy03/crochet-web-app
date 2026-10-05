import { products } from '../data/products.js';
import { $, formatMoney, showToast } from '../utils/dom.js';
import { loadCart, saveCart } from '../utils/storage.js';
export const cartItems = loadCart(products);
export function renderCart() {
  saveCart(cartItems);
  $('count').textContent = Object.values(cartItems).reduce((a, b) => a + b, 0);
  $('cartItems').innerHTML =
    products
      .filter((p) => cartItems[p.id])
      .map(
        (p) =>
          /* HTML */ `<div class="cartrow">
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
          </div>`,
      )
      .join('') || '<p class="help">Giỏ hàng còn trống. Chọn một cuộn len bạn thích nhé.</p>';
  $('total').textContent = formatMoney(
    products.reduce((s, p) => s + p.price * (cartItems[p.id] || 0), 0),
  );
  $('copy').disabled = $('download').disabled = !Object.keys(cartItems).length;
  document
    .querySelectorAll('[data-order-channel]')
    .forEach((b) => (b.disabled = !Object.keys(cartItems).length));
}
export function addToCart(id, n = 1) {
  if (!products.some((product) => product.id === Number(id)) || !Number.isInteger(n) || n < 1)
    return;
  const old = cartItems[id] || 0;
  cartItems[id] = Math.min(99, old + n);
  renderCart();
  showToast(old + n > 99 ? 'Tối đa 99 sản phẩm mỗi loại.' : 'Đã thêm vào giỏ len ♡');
}

export function initCart() {
  $('openCart').onclick = () => $('cart').showModal();
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
    cartItems[id] = Math.min(99, (cartItems[id] || 0) + Number(quantityButton.dataset.delta));
    if (cartItems[id] <= 0) delete cartItems[id];
    renderCart();
  };
  renderCart();
}
