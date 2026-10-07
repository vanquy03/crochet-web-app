import { api } from '../services/api.js';
import { loadCustomerSession, customerCsrf } from '../services/customer.js';
import { escapeHTML as h } from '../utils/html.js';
import { formatMoney } from '../utils/dom.js';
const $ = (id) => document.getElementById(id);
const labels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};
let page = 1,
  pages = 1;
function redirectLogin() {
  location.replace('/login/?next=%2Faccount%2F');
}
async function loadOrders() {
  $('historyStatus').textContent = 'Đang tải đơn hàng…';
  $('previousOrders').disabled = $('nextOrders').disabled = true;
  try {
    const result = await api('/customer/orders?page=' + page);
    page = result.page;
    pages = result.pages;
    $('orderHistory').innerHTML =
      result.orders
        .map((order) => {
          const date = new Date(order.created_at.replace(' ', 'T') + 'Z');
          return (
            '<article class="history-card">' +
            '<div class="history-head"><div><p class="help">' +
            h(date.toLocaleString('vi-VN')) +
            '</p><h2>' +
            h(order.id) +
            '</h2></div>' +
            '<span class="status-badge status-' +
            h(order.status) +
            '">' +
            h(labels[order.status]) +
            '</span></div>' +
            '<ul class="history-items">' +
            order.items
              .map(
                (item) =>
                  '<li><span>' +
                  h(item.name) +
                  ' × ' +
                  item.quantity +
                  '</span><strong>' +
                  formatMoney(item.price * item.quantity) +
                  '</strong></li>',
              )
              .join('') +
            '</ul>' +
            '<div class="history-total"><span>' +
            (order.status === 'cancelled'
              ? 'Đơn đã hủy'
              : order.paid
                ? 'Đã thanh toán'
                : 'Thanh toán khi nhận hàng') +
            '</span><strong>' +
            formatMoney(order.total) +
            '</strong></div>' +
            '<details class="delivery-details"><summary>Thông tin giao hàng</summary><p>' +
            h(order.name) +
            ' · ' +
            h(order.phone) +
            '</p><p>' +
            h(order.address) +
            '</p>' +
            (order.note ? '<p>Lời nhắn: ' + h(order.note) + '</p>' : '') +
            '<p>Tiền sản phẩm: ' +
            formatMoney(order.subtotal) +
            ' · Phí giao: ' +
            formatMoney(order.shipping_fee) +
            '</p></details></article>'
          );
        })
        .join('') ||
      '<div class="history-empty"><h2>Chưa có đơn hàng nào</h2><p class="help">Ghé góc trưng bày và liên hệ với mình khi bạn muốn mua nhé.</p><a class="primary" href="/#san-pham">Khám phá sản phẩm</a></div>';
    $('historyStatus').textContent = '';
    $('historyCount').textContent = result.total + ' đơn hàng';
    $('historyPage').textContent = 'Trang ' + page + ' / ' + pages;
    $('historyPagination').hidden = pages <= 1;
  } catch (error) {
    if (error.status === 401) return redirectLogin();
    $('historyStatus').textContent = error.message;
  } finally {
    $('previousOrders').disabled = page <= 1;
    $('nextOrders').disabled = page >= pages;
  }
}
$('previousOrders').onclick = () => {
  if (page > 1) {
    page--;
    loadOrders();
  }
};
$('nextOrders').onclick = () => {
  if (page < pages) {
    page++;
    loadOrders();
  }
};
$('refreshOrders').onclick = loadOrders;
$('customerLogout').onclick = async () => {
  $('customerLogout').disabled = true;
  try {
    await api('/customer/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': customerCsrf },
      body: '{}',
    });
    try {
      localStorage.removeItem('tiemlen-cart');
      sessionStorage.removeItem('tiemlen-cart-intent');
      sessionStorage.removeItem('tiemlen-pending-request');
    } catch {
      /* Không cản trở đăng xuất khi storage bị chặn. */
    }
    location.replace('/');
  } catch (error) {
    if (error.status === 401) return location.replace('/');
    $('historyStatus').textContent = error.message;
    $('customerLogout').disabled = false;
  }
};
try {
  const session = await loadCustomerSession();
  if (!session.customer) redirectLogin();
  else {
    $('customerName').textContent = session.customer.name;
    $('customerEmail').textContent = session.customer.email;
    $('accountContent').hidden = false;
    await loadOrders();
  }
} catch (error) {
  $('historyStatus').textContent = error.message;
}
