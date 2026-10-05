import { shop } from '../config/shop.js';
import { $ } from '../utils/dom.js';
import { cartItems } from './cart.js';
import { createOrderText, copyOrder } from './order.js';
function createContactLink(name, url, container, orderMode = false) {
  const b = document.createElement(orderMode ? 'button' : 'a');
  b.className = 'secondary';
  b.textContent = name;
  if (orderMode) {
    b.dataset.orderChannel = name;
    b.onclick = () => {
      if (!Object.keys(cartItems).length) return;
      if (url.startsWith('mailto:')) {
        window.location.href =
          url +
          '?subject=' +
          encodeURIComponent('Hỏi mua len — ' + (shop.name || 'Tiệm Len')) +
          '&body=' +
          encodeURIComponent(createOrderText());
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
        copyOrder();
      }
    };
  } else {
    b.href = url;
    if (!url.startsWith('mailto:') && !url.startsWith('tel:')) {
      b.target = '_blank';
      b.rel = 'noopener noreferrer';
    }
  }
  $(container).append(b);
}

export function initContact() {
  let channels = 0;
  const zalo = String(shop.zaloPhone || '').replace(/[^0-9]/g, '');
  if (/^0\d{9}$/.test(zalo)) {
    createContactLink('Nhắn Zalo', 'https://zalo.me/' + zalo, 'contactLinks');
    createContactLink('Liên hệ qua Zalo', 'https://zalo.me/' + zalo, 'orderChannels', true);
    channels++;
  }
  let facebook;
  try {
    const u = new URL(shop.facebookUrl);
    if (
      u.protocol === 'https:' &&
      [
        'facebook.com',
        'www.facebook.com',
        'm.facebook.com',
        'fb.com',
        'www.fb.com',
        'm.me',
      ].includes(u.hostname)
    )
      facebook = u.href;
  } catch {
    /* Bỏ qua địa chỉ Facebook chưa hợp lệ. */
  }
  if (facebook) {
    createContactLink('Facebook của tiệm', facebook, 'contactLinks');
    createContactLink('Liên hệ qua Facebook', facebook, 'orderChannels', true);
    channels++;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shop.email || '')) {
    createContactLink('Email cho tiệm', 'mailto:' + shop.email, 'contactLinks');
    createContactLink('Soạn email hỏi mua', 'mailto:' + shop.email, 'orderChannels', true);
    channels++;
  }
  const phone = String(shop.phone || '').replace(/[^0-9+]/g, '');
  if (/^\+?\d{9,15}$/.test(phone)) {
    createContactLink('Gọi ' + phone, 'tel:' + phone, 'contactLinks');
    channels++;
  }
  $('contactStatus').textContent = channels
    ? 'Tiệm sẽ xác nhận sản phẩm và thông tin giao hàng qua kênh bạn chọn.'
    : 'Tiệm đang cập nhật thông tin liên hệ. Bạn có thể chọn len và lưu danh sách trước.';
  $('footerContact').textContent = channels
    ? shop.name + ' · ' + (phone || shop.email || 'Liên hệ qua Zalo / Facebook')
    : 'Thông tin shop đang được cập nhật.';
  if (shop.demo) {
    const note = document.createElement('p');
    note.className = 'demo-note';
    note.textContent =
      'Bản trưng bày mẫu: hình minh họa, sản phẩm và giá cần được shop cập nhật trước khi bán.';
    $('san-pham').insertBefore(note, $('san-pham').firstChild);
  }
  if (shop.name) {
    document.title = shop.name + ' • Một chút len, nhiều thương yêu';
    document.querySelector('.logo').lastChild.textContent = ' ' + shop.name;
  }
}
