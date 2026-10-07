import { api } from '../services/api.js';
import { loadProducts, products } from '../data/products.js';
import { renderCart, cartItems } from './cart.js';
import { renderCatalog } from './catalog.js';
import { $, formatMoney } from '../utils/dom.js';
import { escapeHTML } from '../utils/html.js';
import {
  customer,
  customerCsrf,
  loadCustomerSession,
  loginRequired,
  clearCustomer,
} from '../services/customer.js';
import { shop, backendAvailable } from '../config/shop.js';
let submitting = false,
  pendingRequest = null;
export function initCheckout() {
  if (customer && !$('buyerName').value) $('buyerName').value = customer.name;
  try {
    pendingRequest = JSON.parse(sessionStorage.getItem('tiemlen-pending-request') || 'null');
  } catch {
    /* Có thể đặt hàng khi storage bị chặn. */
  }
  $('buyerForm').onsubmit = async (event) => {
    event.preventDefault();
    if (submitting || !backendAvailable) return;
    try {
      await loadCustomerSession();
    } catch {
      $('checkoutStatus').textContent = 'Không kết nối được cửa hàng. Vui lòng thử lại.';
      return;
    }
    if (submitting || loginRequired('/?cart=1')) return;
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
        new TextEncoder().encode(JSON.stringify({ customerId: customer.id, ...identity })),
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
        headers: { 'Idempotency-Key': pendingRequest.key, 'X-CSRF-Token': customerCsrf },
        body: JSON.stringify(body),
      });
      const order = result.order;
      $('orderReceipt').innerHTML =
        `<div class="receipt"><strong>Đã nhận đơn hàng của bạn</strong><p>Mã đơn:</p><code>${escapeHTML(order.id)}</code><p><a href="/account/">Xem đơn hàng của tôi →</a></p><p>Tổng COD: ${formatMoney(order.total)}</p><button type="button" class="secondary" id="saveReceipt">Tải thông tin đơn</button></div>`;
      $('saveReceipt').onclick = () => {
        const body = `NHUNG CAP\nMã đơn: ${order.id}\nTổng COD: ${formatMoney(order.total)}\nĐăng nhập website để xem lịch sử và trạng thái đơn.`;
        const url = URL.createObjectURL(
          new Blob(['\uFEFF' + body], { type: 'text/plain;charset=utf-8' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = 'don-hang-len.txt';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
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
      $('checkoutStatus').textContent = 'Đơn đã lưu. Mình sẽ liên hệ xác nhận và gửi hàng.';
      renderCart();
      try {
        await loadProducts();
        renderCatalog();
      } catch {
        /* Đơn đã lưu dù tải lại danh mục thất bại. */
      }
    } catch (error) {
      if (error.status === 401) {
        clearCustomer();
        loginRequired('/?cart=1');
        return;
      }
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
}
