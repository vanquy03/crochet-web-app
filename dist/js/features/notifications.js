import { api } from '../services/api.js';
import { loadCustomerSession } from '../services/customer.js';
import { escapeHTML as h } from '../utils/html.js';
const bell = document.getElementById('notificationsButton');
const badge = document.getElementById('notificationsBadge');
let session,
  dialog,
  page = 1,
  pages = 1,
  loading = false,
  lastUnread = 0,
  generation = 0;
function count(unread) {
  lastUnread = unread;
  badge.hidden = unread === 0;
  badge.textContent = unread > 99 ? '99+' : String(unread);
  bell.setAttribute('aria-label', unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo');
}
function date(value) {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z').toLocaleString(
    'vi-VN',
    { dateStyle: 'short', timeStyle: 'short' },
  );
}
function icon(kind) {
  const path =
    kind === 'like'
      ? '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>'
      : kind === 'comment'
        ? '<path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1.5-6A8 8 0 1 1 21 11Z"/>'
        : '<path d="M3 10v4h4l10 5V5L7 10H3ZM7 14l2 7h3l-2-6M21 9v6"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
function createDialog() {
  dialog = document.createElement('dialog');
  dialog.className = 'notifications-dialog';
  dialog.setAttribute('aria-labelledby', 'notificationsTitle');
  dialog.innerHTML = `<div class="dialoghead"><h2 id="notificationsTitle">Thông báo của bạn</h2><button class="close" type="button" aria-label="Đóng thông báo" id="closeNotifications">×</button></div>
    <div class="notifications-tools"><span class="help" id="notificationSummary"></span><div class="notifications-controls"><button class="secondary" type="button" id="refreshNotifications">Làm mới</button><button class="secondary" type="button" id="readAllNotifications">Đọc tất cả</button></div></div>
    <p class="help" id="notificationStatus" role="status" aria-live="polite"></p><div id="notificationList"></div>
    <div class="notifications-pagination" id="notificationPagination" hidden><button class="secondary" type="button" id="previousNotifications">Trang trước</button><span class="help" id="notificationPage"></span><button class="secondary" type="button" id="nextNotifications">Trang sau</button></div>`;
  document.body.append(dialog);
  get('refreshNotifications').onclick = () => load();
  get('closeNotifications').onclick = () => dialog.close();
  get('readAllNotifications').onclick = async () => {
    get('readAllNotifications').disabled = true;
    try {
      await write('/notifications/read-all', 'POST');
      await load();
    } catch (error) {
      get('notificationStatus').textContent = error.message;
    } finally {
      get('readAllNotifications').disabled = false;
    }
  };
  get('previousNotifications').onclick = () => {
    if (page > 1) {
      page--;
      load();
    }
  };
  get('nextNotifications').onclick = () => {
    if (page < pages) {
      page++;
      load();
    }
  };
  get('notificationList').onclick = async (event) => {
    const button = event.target.closest('[data-read-notification]');
    if (!button) return;
    event.preventDefault();
    button.disabled = true;
    try {
      const result = await write(
        '/notifications/' + button.dataset.readNotification + '/read',
        'PATCH',
      );
      count(result.unread);
      if (button.dataset.href) location.assign(button.dataset.href);
      else await load();
    } catch (error) {
      get('notificationStatus').textContent = error.message;
      button.disabled = false;
    }
  };
}
function get(id) {
  return dialog.querySelector('#' + id);
}
function write(path, method) {
  return api('/customer' + path, {
    method,
    headers: { 'X-CSRF-Token': session.csrfToken },
    body: '{}',
  });
}
async function load() {
  const current = ++generation;
  get('notificationStatus').textContent = 'Đang tải thông báo…';
  try {
    const result = await api('/customer/notifications?page=' + page);
    if (current !== generation) return;
    page = result.page;
    pages = result.pages;
    count(result.unread);
    get('notificationSummary').textContent = result.unread + ' thông báo chưa đọc';
    get('notificationList').innerHTML =
      result.notifications
        .map(
          (item) => `<article class="notification-item ${item.read ? '' : 'unread'}">
      <span class="notification-kind-icon">${icon(item.kind)}</span><div class="notification-copy"><strong>${h(item.title)}</strong><p>${h(item.body)}</p><small>${h(date(item.createdAt))}</small><br>
      ${item.href ? `<button type="button" class="notification-read" data-read-notification="${item.id}" data-href="${h(item.href)}">Xem câu chuyện →</button>` : `<button type="button" class="notification-read" data-read-notification="${item.id}" ${item.read ? 'disabled' : ''}>${item.read ? 'Đã đọc' : 'Đánh dấu đã đọc'}</button>`}</div></article>`,
        )
        .join('') ||
      '<p class="help">Chưa có thông báo. Những lời chia sẻ và trái tim mới sẽ xuất hiện ở đây.</p>';
    get('notificationPagination').hidden = pages <= 1;
    get('notificationPage').textContent = 'Trang ' + page + ' / ' + pages;
    get('previousNotifications').disabled = page <= 1;
    get('nextNotifications').disabled = page >= pages;
    get('notificationStatus').textContent = '';
  } catch (error) {
    if (current === generation) get('notificationStatus').textContent = error.message;
    if (error.status === 401) stop();
  }
}
let timer;
function stop() {
  clearInterval(timer);
  bell.hidden = true;
  dialog?.close();
}
async function refresh() {
  if (document.hidden || loading) return;
  loading = true;
  try {
    const unread = (await api('/customer/notifications/unread')).unread;
    const changed = unread !== lastUnread;
    count(unread);
    if (dialog?.open && changed) {
      get('notificationSummary').textContent = unread + ' thông báo chưa đọc';
      get('notificationStatus').textContent = 'Danh sách có thay đổi. Nhấn Làm mới để cập nhật.';
    }
  } catch (error) {
    if (error.status === 401) stop();
  } finally {
    loading = false;
  }
}
if (bell) {
  try {
    session = await loadCustomerSession();
    if (session.customer) {
      bell.hidden = false;
      bell.onclick = () => {
        if (!dialog) createDialog();
        page = 1;
        dialog.showModal();
        load();
      };
      await refresh();
      if (!bell.hidden) timer = setInterval(refresh, 15000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refresh();
      });
      window.addEventListener('pagehide', () => clearInterval(timer));
      window.addEventListener('pageshow', (event) => {
        if (event.persisted && !bell.hidden) {
          timer = setInterval(refresh, 15000);
          refresh();
        }
      });
    }
  } catch {
    bell.hidden = true;
  }
}
