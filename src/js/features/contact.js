import { escapeHTML as h } from '../utils/html.js';
import { shop } from '../config/shop.js';
import { $ } from '../utils/dom.js';
import { cartItems } from './cart.js';
import { createOrderText, copyOrder } from './order.js';
const contactIcons = {
  zalo: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 10 10 0 0 1-4-.9L3 21l1.4-4.5A8.5 8.5 0 0 1 3 11.5a9 9 0 0 1 18 0Z"/><path d="M9 8h6l-6 7h6"/>',
  facebook:
    '<path d="M14 21v-8h3l.5-4H14V7c0-1 .4-2 2-2h2V1.5A24 24 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v8Z"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  phone:
    '<path d="M8 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-4l-5-2-2 2a14 14 0 0 1-6-6l2-2-2-5Z"/>',
};
function createContactLink(name, url, container, orderMode = false) {
  const b = document.createElement(orderMode ? 'button' : 'a');
  const kind = url.startsWith('mailto:')
    ? 'email'
    : url.startsWith('tel:')
      ? 'phone'
      : url.includes('zalo.me')
        ? 'zalo'
        : 'facebook';
  const descriptions = {
    zalo: 'Gửi mẫu, trao đổi ý tưởng',
    facebook: 'Ghé tiệm và nhắn tin',
    email: shop.email,
    phone: url.slice(4),
  };
  b.className = orderMode ? 'secondary contact-order-link' : 'contact-channel contact-' + kind;
  b.innerHTML = `<span class="contact-channel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${contactIcons[kind]}</svg></span><span class="contact-channel-copy"><strong>${h(name)}</strong>${orderMode ? '' : `<small>${h(descriptions[kind])}</small>`}</span>${orderMode ? '' : `<span class="contact-channel-arrow" aria-hidden="true">${kind === 'phone' || kind === 'email' ? '→' : '↗'}</span>`}`;
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
    : 'Bạn có thể đặt hàng COD trực tiếp trong giỏ hàng.';
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
