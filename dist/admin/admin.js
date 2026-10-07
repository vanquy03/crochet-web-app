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
let announcementPage = 1,
  announcementPages = 1;
let mediaItems = [],
  uploadingMedia = false;
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
    editing || {
      kind: 'handmade',
      price: 0,
      stock: 0,
      active: true,
      color: '#c69592',
      bg: '#f1e4df',
      imageUrl: '',
    },
  );
  mediaItems = (
    editing?.media ||
    (editing?.imageUrl ? [{ type: 'image', url: editing.imageUrl, primary: true }] : [])
  ).map((item) => ({ ...item }));
  renderMediaEditor();
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
      for (const tab of ['products', 'orders', 'community', 'notifications', 'settings', 'account'])
        $(tab + 'Panel').hidden = tab !== button.dataset.tab;
      try {
        if (button.dataset.tab === 'notifications') await loadAnnouncements();
        if (button.dataset.tab === 'community') await loadCommunity();
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
function renderMediaEditor() {
  $('productMedia').innerHTML = mediaItems
    .map(
      (item, i) => `<article class="admin-media-item">
    ${item.type === 'image' ? `<img src="${h(item.url)}" alt="Ảnh sản phẩm ${i + 1}">` : `<video src="${h(item.url)}" controls playsinline preload="metadata"></video>`}
    <div class="media-item-actions">${item.type === 'image' ? `<label class="check"><input type="radio" name="primaryMedia" value="${i}" ${item.primary ? 'checked' : ''}>Ảnh chính</label>` : '<span>Video</span>'}
    <button type="button" class="secondary" data-media-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Đưa file ${i + 1} lên trước">↑</button>
    <button type="button" class="secondary" data-media-down="${i}" ${i === mediaItems.length - 1 ? 'disabled' : ''} aria-label="Đưa file ${i + 1} ra sau">↓</button>
    <button type="button" class="secondary" data-media-remove="${i}">Gỡ</button></div>
  </article>`,
    )
    .join('');
}
function addMedia(item) {
  if (mediaItems.length >= 12) throw new Error('Tối đa 12 ảnh/video.');
  if (mediaItems.some((existing) => existing.url === item.url))
    throw new Error('File này đã có trong gallery.');
  mediaItems.push({
    ...item,
    primary: item.type === 'image' && !mediaItems.some((existing) => existing.primary),
  });
  renderMediaEditor();
}
$('productMedia').onchange = (event) => {
  if (event.target.name !== 'primaryMedia') return;
  mediaItems.forEach((item, i) => (item.primary = i === Number(event.target.value)));
};
$('productMedia').onclick = (event) => {
  if (uploadingMedia) return;
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.mediaRemove !== undefined) {
    mediaItems.splice(Number(button.dataset.mediaRemove), 1);
    if (!mediaItems.some((item) => item.primary)) {
      const first = mediaItems.find((item) => item.type === 'image');
      if (first) first.primary = true;
    }
  } else {
    const up = button.dataset.mediaUp !== undefined;
    const index = Number(up ? button.dataset.mediaUp : button.dataset.mediaDown);
    const target = index + (up ? -1 : 1);
    if (target < 0 || target >= mediaItems.length) return;
    [mediaItems[index], mediaItems[target]] = [mediaItems[target], mediaItems[index]];
  }
  renderMediaEditor();
};
$('addMediaUrl').onclick = () => {
  if (uploadingMedia) return;
  try {
    const url = new URL($('mediaUrl').value.trim());
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('URL phải dùng HTTPS.');
    addMedia({ url: url.href, type: $('mediaType').value });
    $('mediaUrl').value = '';
    $('productError').textContent = '';
  } catch (error) {
    $('productError').textContent = error.message;
  }
};
$('imageFile').onchange = async (event) => {
  const files = [...event.target.files];
  if (!files.length || uploadingMedia) return;
  uploadingMedia = true;
  const button = $('productForm').querySelector('.primary');
  button.disabled = true;
  try {
    if (files.length + mediaItems.length > 12) throw new Error('Tối đa 12 ảnh/video.');
    for (const [i, file] of files.entries()) {
      const video = file.type.startsWith('video/');
      if (file.size > (video ? 30 : 5) * 1024 * 1024)
        throw new Error(video ? 'Video tối đa 30 MB.' : 'Ảnh tối đa 5 MB.');
      $('productError').textContent = `Đang tải file ${i + 1} / ${files.length}…`;
      const data = new FormData();
      data.append('file', file);
      addMedia(await request('/media', { method: 'POST', body: data }));
    }
    $('productError').textContent = 'Đã tải file, nhấn Lưu sản phẩm để sử dụng.';
  } catch (error) {
    $('productError').textContent = error.message;
  } finally {
    uploadingMedia = false;
    button.disabled = false;
    event.target.value = '';
  }
};
$('productForm').onsubmit = (event) => {
  event.preventDefault();
  if (uploadingMedia) return;
  busy(
    event.currentTarget,
    async () => {
      const data = formData($('productForm'));
      data.media = mediaItems;
      data.imageUrl = mediaItems.find((item) => item.primary)?.url || '';
      delete data.primaryMedia;
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

let communityPage = 1,
  communityPages = 1,
  communityPosts = [];
async function loadCommunity() {
  const result = await request('/community/posts?page=' + communityPage);
  communityPage = result.page;
  communityPages = result.pages;
  communityPosts = result.posts;
  $('communityRows').innerHTML =
    result.posts
      .map(
        (p) =>
          '<article class="guide"><h3>' +
          h(p.title) +
          '</h3><p>' +
          h(p.author.name) +
          ' · ' +
          h(p.status) +
          '</p><p>' +
          h(p.excerpt) +
          '</p><div class="actions">' +
          (['published', 'hidden'].includes(p.status)
            ? '<button class="secondary" data-moderate="' +
              p.id +
              '">' +
              (p.status === 'hidden' ? 'Hiện lại bài' : 'Ẩn bài') +
              '</button>'
            : '') +
          '<button class="secondary" data-comments="' +
          p.id +
          '">Xem bình luận</button></div></article>',
      )
      .join('') || '<p>Chưa có bài viết.</p>';
  $('communityPage').textContent = 'Trang ' + communityPage + '/' + communityPages;
  $('communityPrev').disabled = communityPage <= 1;
  $('communityNext').disabled = communityPage >= communityPages;
}
async function moderationComments(id, page = 1) {
  const result = await request('/community/posts/' + id + '/comments?page=' + page);
  $('moderationComments').innerHTML =
    result.comments
      .map(
        (c) =>
          '<article class="guide"><strong>' +
          h(c.author.name) +
          '</strong><p style="white-space:pre-wrap">' +
          h(c.content) +
          '</p>' +
          (c.hidden
            ? '<small>Đã ẩn</small>'
            : '<button class="secondary" data-hide-comment="' +
              c.id +
              '" data-post="' +
              id +
              '">Ẩn bình luận</button>') +
          '</article>',
      )
      .join('') || '<p>Chưa có bình luận.</p>';
  if (result.pages > 1)
    $('moderationComments').innerHTML +=
      '<div class="actions">' +
      (result.page > 1
        ? '<button class="secondary" data-comment-page="' +
          (result.page - 1) +
          '" data-post="' +
          id +
          '">Trang trước</button>'
        : '') +
      '<span>Trang ' +
      result.page +
      '/' +
      result.pages +
      '</span>' +
      (result.page < result.pages
        ? '<button class="secondary" data-comment-page="' +
          (result.page + 1) +
          '" data-post="' +
          id +
          '">Trang sau</button>'
        : '') +
      '</div>';
}
$('communityRows').onclick = async (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.moderate) {
      const p = communityPosts.find((p) => p.id === Number(button.dataset.moderate));
      await request('/community/posts/' + p.id, {
        method: 'PATCH',
        body: JSON.stringify({ hidden: p.status !== 'hidden', version: p.version }),
      });
      await loadCommunity();
      message('Đã cập nhật bài viết.');
    }
    if (button.dataset.comments) await moderationComments(button.dataset.comments);
  } catch (error) {
    message(error.message);
  }
};
$('moderationComments').onclick = async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.hideComment) {
      await request('/community/posts/' + b.dataset.post + '/comments/' + b.dataset.hideComment, {
        method: 'DELETE',
        body: '{}',
      });
      await moderationComments(b.dataset.post);
    }
    if (b.dataset.commentPage)
      await moderationComments(b.dataset.post, Number(b.dataset.commentPage));
  } catch (error) {
    message(error.message);
  }
};
$('communityPrev').onclick = async () => {
  communityPage--;
  try {
    await loadCommunity();
  } catch (e) {
    message(e.message);
  }
};
$('communityNext').onclick = async () => {
  communityPage++;
  try {
    await loadCommunity();
  } catch (e) {
    message(e.message);
  }
};

async function loadAnnouncements() {
  const result = await request('/notifications?page=' + announcementPage);
  announcementPage = result.page;
  announcementPages = result.pages;
  $('announcementHistory').innerHTML =
    result.announcements
      .map(
        (item) =>
          `<article class="announcement-item"><strong>${h(item.title)}</strong><p>${h(item.body)}</p><small>${h(item.createdAt)} · ${item.recipients} thành viên</small></article>`,
      )
      .join('') || '<p class="help">Chưa gửi thông báo nào.</p>';
  $('announcementsPage').textContent = 'Trang ' + announcementPage + ' / ' + announcementPages;
  $('announcementsPrev').disabled = announcementPage <= 1;
  $('announcementsNext').disabled = announcementPage >= announcementPages;
}
$('announcementForm').onsubmit = (event) => {
  event.preventDefault();
  if (!$('announcementForm').reportValidity()) return;
  busy(
    event.currentTarget,
    async () => {
      const result = await request('/notifications', {
        method: 'POST',
        body: JSON.stringify(formData($('announcementForm'))),
      });
      $('announcementForm').reset();
      announcementPage = 1;
      $('announcementStatus').textContent =
        'Đã gửi thông báo tới ' + result.recipients + ' thành viên.';
      await loadAnnouncements();
    },
    'announcementStatus',
  );
};
$('announcementsPrev').onclick = async () => {
  if (announcementPage > 1) {
    announcementPage--;
    try {
      await loadAnnouncements();
    } catch (error) {
      message(error.message);
    }
  }
};
$('announcementsNext').onclick = async () => {
  if (announcementPage < announcementPages) {
    announcementPage++;
    try {
      await loadAnnouncements();
    } catch (error) {
      message(error.message);
    }
  }
};
