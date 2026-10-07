import { escapeHTML as h } from '../utils/html.js';
import { shop } from '../config/shop.js';
import { $ } from '../utils/dom.js';
const contactIcons = {
  tiktok: '<path d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 6 6V6c-2 0-3-1-3-3h-3Z"/>',
  zalo: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 10 10 0 0 1-4-.9L3 21l1.4-4.5A8.5 8.5 0 0 1 3 11.5a9 9 0 0 1 18 0Z"/><path d="M9 8h6l-6 7h6"/>',
  facebook:
    '<path d="M14 21v-8h3l.5-4H14V7c0-1 .4-2 2-2h2V1.5A24 24 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v8Z"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  phone:
    '<path d="M8 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-4l-5-2-2 2a14 14 0 0 1-6-6l2-2-2-5Z"/>',
};
function createContactLink(name, url, container) {
  const b = document.createElement('a');
  const kind = url.startsWith('mailto:')
    ? 'email'
    : url.startsWith('tel:')
      ? 'phone'
      : url.includes('zalo.me')
        ? 'zalo'
        : new URL(url).hostname.endsWith('tiktok.com')
          ? 'tiktok'
          : 'facebook';
  const descriptions = {
    zalo: 'Gửi mẫu, trao đổi ý tưởng',
    facebook: 'Theo dõi và thả tim cho mình nhé ♡',
    tiktok: 'Ủng hộ mình bằng 1 follow nhé',
    email: shop.email,
    phone: url.slice(4),
  };
  b.className = 'contact-channel contact-' + kind;
  b.innerHTML = `<span class="contact-channel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${contactIcons[kind]}</svg></span><span class="contact-channel-copy"><strong>${h(name)}</strong><small>${h(descriptions[kind])}</small></span><span class="contact-channel-arrow" aria-hidden="true">${kind === 'phone' || kind === 'email' ? '→' : '↗'}</span>`;
  b.href = url;
  if (!url.startsWith('mailto:') && !url.startsWith('tel:')) {
    b.target = '_blank';
    b.rel = 'noopener noreferrer';
  }
  $(container).append(b);
}

export function initContact() {
  let channels = 0;
  const zalo = String(shop.zaloPhone || '').replace(/[^0-9]/g, '');
  if (/^0\d{9}$/.test(zalo)) {
    createContactLink('Zalo', 'https://zalo.me/' + zalo, 'contactLinks');
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
    createContactLink('Facebook', facebook, 'contactLinks');
    channels++;
  }
  try {
    const url = new URL(shop.tiktokUrl);
    if (
      url.protocol === 'https:' &&
      ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(
        url.hostname,
      )
    ) {
      createContactLink('TikTok', url.href, 'contactLinks');
      channels++;
    }
  } catch {
    /* Bỏ qua địa chỉ TikTok chưa hợp lệ. */
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shop.email || '')) {
    createContactLink('Email', 'mailto:' + shop.email, 'contactLinks');
    channels++;
  }
  const phone = String(shop.phone || '').replace(/[^0-9+]/g, '');
  if (/^\+?\d{9,15}$/.test(phone)) {
    createContactLink('Điện thoại', 'tel:' + phone, 'contactLinks');
    channels++;
  }
  $('contactStatus').textContent = channels
    ? 'Nhắn mình để chốt món bạn thích và thông tin giao hàng nhé.'
    : 'Thông tin liên hệ đang được cập nhật. Bạn hãy ghé lại sau để nhắn mình nhé.';
  $('footerContact').textContent = channels
    ? shop.name + ' · ' + (phone || shop.email || 'Kết nối với mình qua các kênh bên trên')
    : 'Thông tin shop đang được cập nhật.';
  if (shop.name) {
    document.title =
      shop.name + ($('contactPage') ? ' • Liên hệ' : ' • Một chút len, nhiều thương yêu');
    document.querySelector('.logo').lastChild.textContent = ' ' + shop.name;
  }
}
