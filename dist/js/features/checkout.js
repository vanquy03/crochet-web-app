import { api } from '../services/api.js';
import { loadProducts, products } from '../data/products.js';
import { renderCart, cartItems } from './cart.js';
import { renderCatalog } from './catalog.js';
import { $, formatMoney } from '../utils/dom.js';
import { escapeHTML } from '../utils/html.js';
import { shop, backendAvailable } from '../config/shop.js';
const labels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};
let submitting = false,
  pendingRequest = null;
export function initCheckout() {
  try {
    pendingRequest = JSON.parse(sessionStorage.getItem('tiemlen-pending-request') || 'null');
  } catch {
    /* Có thể đặt hàng khi storage bị chặn. */
  }
  $('buyerForm').onsubmit = async (event) => {
    event.preventDefault();
    if (submitting || !backendAvailable) return;
    if (!$('buyerForm').reportValidity() || !Object.keys(cartItems).length) return;
    const subtotal = products.reduce((sum, p) => sum + p.price * (cartItems[p.id] || 0), 0);
    const fee =
      shop.freeShippingThreshold > 0 && subtotal >= shop.freeShippingThreshold
        ? 0
        : shop.shippingFee;
    const body = {
      name: $('buyerName').value.trim(),
      phone: $('buyerPhone').value.trim(),
      address: $('buyerAddress').value.trim(),
      note: $('buyerNote').value.trim(),
      paymentMethod: 'cod',
      expectedTotal: subtotal + fee,
      items: Object.entries(cartItems).map(([id, quantity]) => ({
        productId: Number(id),
        quantity,
      })),
    };

    submitting = true;
    $('submitOrder').disabled = true;
    $('checkoutStatus').textContent = 'Đang gửi đơn…';
    try {
      const { expectedTotal, ...identity } = body;
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(identity)),
      );
      const fingerprint = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      if (!pendingRequest || pendingRequest.fingerprint !== fingerprint)
        pendingRequest = { fingerprint, key: crypto.randomUUID() };
      try {
        sessionStorage.setItem('tiemlen-pending-request', JSON.stringify(pendingRequest));
      } catch {
        /* Dùng khóa trong bộ nhớ nếu storage bị chặn. */
      }
      const result = await api('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': pendingRequest.key },
        body: JSON.stringify(body),
      });
      const order = result.order;
      $('orderReceipt').innerHTML =
        `<div class="receipt"><strong>Đã nhận đơn hàng của bạn</strong><p>Mã đơn:</p><code>${escapeHTML(order.id)}</code><p>Mã tra cứu riêng (hãy lưu lại):</p><code>${escapeHTML(result.lookupToken)}</code><p>Tổng COD: ${formatMoney(order.total)}</p><button type="button" class="secondary" id="saveReceipt">Tải thông tin đơn</button></div>`;
      $('saveReceipt').onclick = () => {
        const body = `TIỆM LEN\nMã đơn: ${order.id}\nMã tra cứu: ${result.lookupToken}\nTổng COD: ${formatMoney(order.total)}\nGiữ riêng mã tra cứu để xem trạng thái trên website.`;
        const url = URL.createObjectURL(
          new Blob(['\uFEFF' + body], { type: 'text/plain;charset=utf-8' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = 'don-hang-len.txt';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      $('lookupId').value = order.id;
      $('lookupToken').value = result.lookupToken;
      for (const item of body.items) {
        const remaining = (cartItems[item.productId] || 0) - item.quantity;
        if (remaining > 0) cartItems[item.productId] = remaining;
        else delete cartItems[item.productId];
      }
      pendingRequest = null;
      try {
        sessionStorage.removeItem('tiemlen-pending-request');
      } catch {
        /* Storage có thể bị chặn. */
      }
      $('buyerForm').reset();
      $('checkoutStatus').textContent = 'Đơn đã lưu. Tiệm sẽ liên hệ xác nhận và gửi hàng.';
      renderCart();
      try {
        await loadProducts();
        renderCatalog();
      } catch {
        /* Đơn đã lưu dù tải lại danh mục thất bại. */
      }
    } catch (error) {
      $('checkoutStatus').textContent = error.message;
      try {
        await loadProducts();
        Object.assign(shop, await api('/settings'));
        renderCatalog();
      } catch {
        /* Giữ giỏ khi mất kết nối. */
      }
    } finally {
      submitting = false;
      renderCart();
    }
  };
  $('lookupForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    $('lookupResult').textContent = 'Đang tra cứu…';
    try {
      const order = await api('/orders/lookup', {
        method: 'POST',
        body: JSON.stringify({
          id: $('lookupId').value.trim(),
          token: $('lookupToken').value.trim(),
        }),
      });
      $('lookupResult').innerHTML =
        `<div class="receipt"><strong>${escapeHTML(labels[order.status] || order.status)}</strong><p>${escapeHTML(order.id)}</p><p>Tổng COD: ${formatMoney(order.total)} · ${order.paid ? 'Đã thu tiền' : 'Chưa thu tiền'}</p><ul>${order.items.map((item) => `<li>${escapeHTML(item.name)} × ${item.quantity}</li>`).join('')}</ul></div>`;
    } catch (error) {
      $('lookupResult').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
