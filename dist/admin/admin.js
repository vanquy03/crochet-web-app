import { api } from '../js/services/api.js';
import { escapeHTML as h } from '../js/utils/html.js';
import { formatMoney } from '../js/utils/dom.js';
const $ = (id) => document.getElementById(id);
const statusLabels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};
let csrf = '',
  products = [],
  editing = null,
  selectedOrder = null,
  page = 1,
  pages = 1;
async function request(path, options = {}) {
  try {
    return await api('/admin' + path, {
      ...options,
      headers: { 'X-CSRF-Token': csrf, ...options.headers },
    });
  } catch (error) {
    if (error.message === 'Vui lòng đăng nhập.') showLogin();
    throw error;
  }
}
function message(text) {
  $('message').textContent = text;
}
function showLogin() {
  csrf = '';
  $('dashboard').hidden = true;
  $('loginPanel').hidden = false;
  $('logout').hidden = true;
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
}
async function busy(form, operation, errorTarget = 'message') {
  const button = form.querySelector('button[type="submit"],button:not([type])');
  if (button) button.disabled = true;
  $(errorTarget).textContent = '';
  try {
    await operation();
  } catch (error) {
    $(errorTarget).textContent = error.message;
  } finally {
    if (button) button.disabled = false;
  }
}
async function loadDashboard() {
  const stats = await request('/dashboard');
  $('metrics').innerHTML =
    `<div class="metric">Tổng đơn<strong>${stats.orders}</strong></div><div class="metric">Chờ xác nhận<strong>${stats.pending}</strong></div><div class="metric">Doanh thu đã hoàn tất<strong>${formatMoney(stats.revenue)}</strong></div>`;
  if (stats.lowStock.length) {
    const note = document.createElement('p');
    note.className = 'lowstock';
    note.textContent =
      'Sắp hết hàng: ' + stats.lowStock.map((p) => `${p.name} (${p.stock})`).join(', ');
    $('metrics').append(note);
  }
}
async function loadProducts() {
  products = await request('/products');
  $('productRows').innerHTML =
    products
      .map(
        (p) =>
          `<tr><td>${h(p.name)}<br><small>${h(p.type)}</small></td><td>${formatMoney(p.price)}</td><td>${p.stock}</td><td>${p.active ? 'Đang bán' : 'Đã ẩn'}</td><td><button class="secondary" data-edit="${p.id}">Sửa</button>${p.active ? `<button class="secondary" data-hide="${p.id}">Ẩn</button>` : ''}</td></tr>`,
      )
      .join('') || '<tr><td colspan="5">Chưa có sản phẩm.</td></tr>';
}
async function loadOrders() {
  const result = await request(
    '/orders?page=' + page + '&status=' + encodeURIComponent($('orderFilter').value),
  );
  pages = result.pages;
  $('orderRows').innerHTML =
    result.orders
      .map(
        (order) =>
          `<tr><td>${h(order.id)}<br><small>${h(order.created_at)}</small></td><td>${h(order.name)}<br>${h(order.phone)}</td><td>${formatMoney(order.total)}<br><small>${order.paid ? 'Đã thu tiền' : 'Chưa thu'}</small></td><td>${h(statusLabels[order.status])}</td><td><button class="secondary" data-order="${h(order.id)}">Xem đơn</button></td></tr>`,
      )
      .join('') || '<tr><td colspan="5">Chưa có đơn hàng.</td></tr>';
  $('pageInfo').textContent = `Trang ${page}/${pages} · ${result.total} đơn`;
  $('prevPage').disabled = page <= 1;
  $('nextPage').disabled = page >= pages;
}
function fill(form, data) {
  for (const [key, value] of Object.entries(data)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value;
  }
}
function formData(form) {
  const data = Object.fromEntries(new FormData(form));
  for (const field of form.elements) {
    if (field.type === 'checkbox') data[field.name] = field.checked;
    if (field.type === 'number') data[field.name] = Number(field.value);
  }
  return data;
}
async function openDashboard() {
  $('loginPanel').hidden = true;
  $('dashboard').hidden = false;
  $('logout').hidden = false;
  message('');
  await Promise.all([loadProducts(), loadOrders(), loadDashboard()]);
  fill($('settingsForm'), await api('/settings'));
}
function editProduct(id) {
  editing = products.find((p) => p.id === id) || null;
  $('productForm').reset();
  $('imageFile').value = '';
  $('productError').textContent = '';
  $('productTitle').textContent = editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm';
  fill(
    $('productForm'),
    editing || { price: 0, stock: 0, active: true, color: '#c69592', bg: '#f1e4df', imageUrl: '' },
  );
  $('productDialog').showModal();
}
$('loginForm').onsubmit = (event) => {
  event.preventDefault();
  busy(event.currentTarget, async () => {
    const result = await api('/admin/login', {
      method: 'POST',
      body: JSON.stringify(formData($('loginForm'))),
    });
    csrf = result.csrfToken;
    $('loginForm').reset();
    await openDashboard();
  });
};
$('logout').onclick = async () => {
  try {
    await request('/logout', { method: 'POST', body: '{}' });
    showLogin();
  } catch (error) {
    message(error.message);
  }
};
document.querySelectorAll('[data-tab]').forEach(
  (button) =>
    (button.onclick = async () => {
      document.querySelectorAll('[data-tab]').forEach((b) => b.removeAttribute('aria-current'));
      button.setAttribute('aria-current', 'page');
      for (const tab of ['products', 'orders', 'settings', 'account'])
        $(tab + 'Panel').hidden = tab !== button.dataset.tab;
      try {
        if (button.dataset.tab === 'orders') await loadOrders();
        if (button.dataset.tab === 'products') await loadProducts();
        await loadDashboard();
      } catch (error) {
        message(error.message);
      }
    }),
);
document
  .querySelectorAll('[data-close]')
  .forEach((button) => (button.onclick = () => $(button.dataset.close).close()));
$('newProduct').onclick = () => editProduct(null);
$('productRows').onclick = async (event) => {
  const edit = event.target.closest('[data-edit]');
  if (edit) return editProduct(Number(edit.dataset.edit));
  const hide = event.target.closest('[data-hide]');
  if (hide && confirm('Ẩn sản phẩm khỏi cửa hàng?')) {
    try {
      await request('/products/' + hide.dataset.hide, { method: 'DELETE', body: '{}' });
      await loadProducts();
      message('Đã ẩn sản phẩm.');
    } catch (error) {
      message(error.message);
    }
  }
};
$('imageFile').onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const button = $('productForm').querySelector('button');
  button.disabled = true;
  $('productError').textContent = 'Đang tải ảnh…';
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5 MB.');
    const data = new FormData();
    data.append('image', file);
    const result = await request('/uploads', { method: 'POST', body: data });
    $('productForm').elements.imageUrl.value = result.imageUrl;
    $('productError').textContent = 'Đã tải ảnh, nhấn Lưu sản phẩm để sử dụng.';
  } catch (error) {
    $('productError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
$('productForm').onsubmit = (event) => {
  event.preventDefault();
  busy(
    event.currentTarget,
    async () => {
      const data = formData($('productForm'));
      if (editing) data.version = editing.version;
      await request('/products' + (editing ? '/' + editing.id : ''), {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(data),
      });
      $('productDialog').close();
      await Promise.all([loadProducts(), loadDashboard()]);
      message('Đã lưu sản phẩm.');
    },
    'productError',
  );
};
$('orderFilter').onchange = async () => {
  page = 1;
  try {
    await loadOrders();
  } catch (error) {
    message(error.message);
  }
};
$('prevPage').onclick = async () => {
  page--;
  try {
    await loadOrders();
  } catch (error) {
    message(error.message);
  }
};
$('nextPage').onclick = async () => {
  page++;
  try {
    await loadOrders();
  } catch (error) {
    message(error.message);
  }
};
$('orderRows').onclick = async (event) => {
  const button = event.target.closest('[data-order]');
  if (!button) return;
  try {
    selectedOrder = await request('/orders/' + encodeURIComponent(button.dataset.order));
    const o = selectedOrder;
    $('orderDetail').innerHTML =
      `<strong>${h(o.id)}</strong><p>${h(o.name)} · ${h(o.phone)}</p><p>Địa chỉ: ${h(o.address)}</p><p>Lời nhắn: ${h(o.note) || 'Không có'}</p><ul>${o.items.map((item) => `<li>${h(item.name)} × ${item.quantity} — ${formatMoney(item.price * item.quantity)}</li>`).join('')}</ul><p>Tiền hàng ${formatMoney(o.subtotal)} + giao hàng ${formatMoney(o.shipping_fee)}</p><strong>Tổng COD: ${formatMoney(o.total)}</strong>`;
    fill($('orderForm'), { status: o.status, paid: Boolean(o.paid) });
    $('orderError').textContent = '';
    $('orderDialog').showModal();
  } catch (error) {
    message(error.message);
  }
};
$('orderForm').onsubmit = (event) => {
  event.preventDefault();
  busy(
    event.currentTarget,
    async () => {
      await request('/orders/' + encodeURIComponent(selectedOrder.id), {
        method: 'PATCH',
        body: JSON.stringify(formData($('orderForm'))),
      });
      $('orderDialog').close();
      await Promise.all([loadOrders(), loadProducts(), loadDashboard()]);
      message('Đã cập nhật đơn hàng.');
    },
    'orderError',
  );
};
$('settingsForm').onsubmit = (event) => {
  event.preventDefault();
  busy(event.currentTarget, async () => {
    await request('/settings', {
      method: 'PUT',
      body: JSON.stringify(formData($('settingsForm'))),
    });
    message('Đã lưu thông tin và phí giao hàng.');
  });
};
$('passwordForm').onsubmit = (event) => {
  event.preventDefault();
  busy(event.currentTarget, async () => {
    await request('/password', {
      method: 'PUT',
      body: JSON.stringify(formData($('passwordForm'))),
    });
    $('passwordForm').reset();
    showLogin();
    message('Đã đổi mật khẩu. Hãy đăng nhập lại.');
  });
};
try {
  const session = await api('/admin/session');
  csrf = session.csrfToken;
  await openDashboard();
} catch {
  showLogin();
}
