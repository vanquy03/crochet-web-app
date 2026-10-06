import { api } from '../services/api.js';
import { customerCsrf, clearCustomer, loginRequired } from '../services/customer.js';
import { escapeHTML as h } from '../utils/html.js';
export const topicLabels = {
  slow: 'Sống chậm',
  journey: 'Hành trình đan',
  memory: 'Kỷ niệm',
  tips: 'Mẹo nhỏ',
};
export const statusLabels = { draft: 'Bản nháp', published: 'Đã chia sẻ', hidden: 'Đang được ẩn' };
export function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function storyArt(category) {
  const art = {
    slow: '<path d="M92 88h114v68c0 34-114 34-114 0z" fill="#fdf8f2" stroke="#a97a70" stroke-width="3"/><path d="M206 98c48-6 48 62 0 55M127 60c-16-20 20-23 5-44M163 60c-16-20 20-23 5-44" fill="none" stroke="#a97a70" stroke-width="3"/><ellipse cx="150" cy="188" rx="92" ry="9" fill="#d2bba8"/>',
    journey:
      '<circle cx="148" cy="125" r="65" fill="#c59aa5"/><path d="M87 107q63-75 122 16M84 126q66-75 131 15M91 146q65-62 119 13M114 174q26-95 61-106M133 186q9-105 48-111M186 168q60 25 35 56" fill="none" stroke="#f4dfe4" stroke-width="3"/><path d="M94 48l137 135M80 68l144 135" stroke="#92735d" stroke-width="5" stroke-linecap="round"/>',
    memory:
      '<path d="M155 139q-30 43-17 75" stroke="#88a184" stroke-width="5" fill="none"/><ellipse cx="116" cy="165" rx="29" ry="13" transform="rotate(25 116 165)" fill="#a0b297"/><g fill="#d6a1ab"><ellipse cx="153" cy="73" rx="24" ry="36"/><ellipse cx="192" cy="104" rx="36" ry="24"/><ellipse cx="170" cy="144" rx="24" ry="36" transform="rotate(-28 170 144)"/><ellipse cx="123" cy="137" rx="36" ry="24" transform="rotate(-28 123 137)"/><ellipse cx="115" cy="91" rx="36" ry="24" transform="rotate(28 115 91)"/></g><circle cx="153" cy="109" r="25" fill="#ecce89"/>',
    tips: '<rect x="84" y="42" width="137" height="157" rx="10" fill="#fffaf4" stroke="#b1a283" stroke-width="3"/><path d="M108 76h88M108 103h69M108 130h88M108 157h62" stroke="#c9baa2" stroke-width="3"/><path d="M104 38v16M128 38v16M152 38v16M176 38v16M200 38v16" stroke="#a68b77" stroke-width="4"/><path d="M216 168l38-82 8 4-38 82z" fill="#ba8f98"/>',
  };
  return (
    '<svg viewBox="0 0 300 240" aria-hidden="true"><circle cx="150" cy="120" r="105" fill="#ffffff60"/>' +
    (art[category] || art.journey) +
    '</svg>'
  );
}
export function storyCard(post, mine = false) {
  const url = '/story/?id=' + post.id;
  return (
    '<article class="story-card">' +
    '<a class="story-cover topic-' +
    h(post.category) +
    '" href="' +
    url +
    '" aria-label="' +
    h('Đọc ' + post.title) +
    '">' +
    (post.coverUrl
      ? '<img src="' + h(post.coverUrl) + '" alt="" loading="lazy" />'
      : storyArt(post.category)) +
    '</a>' +
    '<div class="story-card-content"><div class="story-tags"><span>' +
    h(topicLabels[post.category]) +
    '</span>' +
    (post.demo ? '<span class="sample-label">Bài mẫu</span>' : '') +
    (mine ? '<span class="post-state">' + h(statusLabels[post.status]) + '</span>' : '') +
    '</div><h2><a href="' +
    url +
    '">' +
    h(post.title) +
    '</a></h2><p class="story-excerpt">' +
    h(post.excerpt) +
    '</p><p class="story-byline">' +
    h(post.author.name) +
    ' · ' +
    h(dateLabel(post.publishedAt || post.createdAt)) +
    '</p><div class="story-card-bottom"><span>♡ ' +
    post.likesCount +
    ' <span class="sr-only">lượt thả tim</span> · ' +
    post.commentsCount +
    ' bình luận</span><a href="' +
    url +
    '">Đọc tiếp <span aria-hidden="true">→</span></a></div>' +
    (mine
      ? '<div class="my-post-actions">' +
        (post.status !== 'hidden'
          ? '<a class="secondary" href="/write/?id=' + post.id + '">Sửa bài</a>'
          : '<span class="help">Liên hệ chủ tiệm để xem lại bài.</span>') +
        '<button class="quiet-button" data-remove-post="' +
        post.id +
        '">Gỡ bài</button></div>'
      : '') +
    '</div></article>'
  );
}
export async function communityRequest(path, options = {}) {
  try {
    return await api(path, {
      ...options,
      headers: { 'X-CSRF-Token': customerCsrf, ...options.headers },
    });
  } catch (error) {
    if (error.status === 401) {
      clearCustomer();
      loginRequired(location.pathname + location.search + location.hash);
    }
    throw error;
  }
}
export function updateMemberLink(customer) {
  const link = document.getElementById('memberLink');
  if (link && customer) {
    link.textContent = 'Góc của tôi';
    link.href = '/account/';
  }
}
