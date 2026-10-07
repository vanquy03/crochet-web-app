import { api } from '../services/api.js';
import { customer, loadCustomerSession, loginRequired } from '../services/customer.js';
import {
  topicLabels,
  dateLabel,
  storyArt,
  communityRequest,
  updateMemberLink,
} from '../components/community.js';
import { escapeHTML as h } from '../utils/html.js';
const $ = (id) => document.getElementById(id);
const id = Number(new URLSearchParams(location.search).get('id'));
let post,
  commentPage = 1,
  commentPages = 1;
function renderLike() {
  $('likePost').setAttribute('aria-pressed', String(post.liked));
  $('likePost').classList.toggle('liked', post.liked);
  $('likePost').textContent =
    (post.liked ? '♥ Đã thả tim' : '♡ Gửi một trái tim') + ' · ' + post.likesCount;
}
async function loadComments() {
  const result = await api('/community/posts/' + id + '/comments?page=' + commentPage);
  commentPage = result.page;
  commentPages = result.pages;
  post.commentsCount = result.total;
  $('commentCount').textContent = result.total + ' lời chia sẻ';
  $('commentList').innerHTML =
    result.comments
      .map(
        (comment) =>
          '<article class="comment"><div class="comment-top"><strong>' +
          h(comment.author.name) +
          '</strong><span>' +
          h(dateLabel(comment.createdAt)) +
          '</span></div><p>' +
          h(comment.content) +
          '</p>' +
          (comment.mine
            ? '<button class="quiet-button" data-remove-comment="' +
              comment.id +
              '">Gỡ bình luận</button>'
            : '') +
          '</article>',
      )
      .join('') || '<p class="help">Chưa có lời chia sẻ nào. Bạn có muốn là người đầu tiên?</p>';
  $('commentPagination').hidden = commentPages <= 1;
  $('commentPage').textContent = 'Trang ' + commentPage + ' / ' + commentPages;
  $('previousComments').disabled = commentPage <= 1;
  $('nextComments').disabled = commentPage >= commentPages;
}
$('likePost').onclick = async () => {
  if (loginRequired('/story/?id=' + id)) return;
  $('likePost').disabled = true;
  try {
    const result = await communityRequest('/community/posts/' + id + '/like', {
      method: 'PUT',
      body: JSON.stringify({ liked: !post.liked }),
    });
    Object.assign(post, result);
    renderLike();
    $('storyStatus').textContent = '';
  } catch (error) {
    $('storyStatus').textContent = error.message;
  } finally {
    $('likePost').disabled = false;
  }
};
$('commentForm').onsubmit = async (event) => {
  event.preventDefault();
  if (loginRequired('/story/?id=' + id + '#comments') || !$('commentForm').reportValidity()) return;
  $('sendComment').disabled = true;
  $('commentStatus').textContent = 'Đang gửi lời chia sẻ…';
  try {
    await communityRequest('/community/posts/' + id + '/comments', {
      method: 'POST',
      body: JSON.stringify({ content: $('commentContent').value.trim() }),
    });
    $('commentForm').reset();
    commentPage = 1;
    await loadComments();
    $('commentStatus').textContent = 'Lời chia sẻ của bạn đã được gửi. Cảm ơn bạn ♡';
  } catch (error) {
    $('commentStatus').textContent = error.message;
  } finally {
    $('sendComment').disabled = false;
  }
};
$('commentList').onclick = async (event) => {
  const button = event.target.closest('[data-remove-comment]');
  if (!button || !confirm('Gỡ bình luận của bạn?')) return;
  button.disabled = true;
  try {
    await communityRequest('/community/posts/' + id + '/comments/' + button.dataset.removeComment, {
      method: 'DELETE',
      body: '{}',
    });
    await loadComments();
  } catch (error) {
    $('commentStatus').textContent = error.message;
    button.disabled = false;
  }
};
$('previousComments').onclick = async () => {
  if (commentPage > 1) {
    commentPage--;
    try {
      await loadComments();
    } catch (error) {
      $('commentStatus').textContent = error.message;
    }
  }
};
$('nextComments').onclick = async () => {
  if (commentPage < commentPages) {
    commentPage++;
    try {
      await loadComments();
    } catch (error) {
      $('commentStatus').textContent = error.message;
    }
  }
};
try {
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error('Không tìm thấy câu chuyện. Bạn hãy quay lại Góc sẻ chia nhé.');
  await loadCustomerSession();
  updateMemberLink(customer);
  post = await api('/community/posts/' + id);
  document.title = post.title + ' • Nhung Cap';
  $('storyTitle').textContent = post.title;
  $('storyTopic').textContent = topicLabels[post.category];
  $('storyAuthor').textContent = post.author.name;
  $('storyDate').textContent = dateLabel(post.publishedAt || post.createdAt);
  $('storyIntro').textContent = post.excerpt;
  $('storyBody').textContent = post.content;
  $('storyDemo').hidden = !post.demo;
  $('storyCover').className = 'article-cover topic-' + post.category;
  $('storyCover').innerHTML = post.coverUrl
    ? '<img src="' + h(post.coverUrl) + '" alt="" />'
    : storyArt(post.category);
  $('editStory').hidden = !post.mine || post.status === 'hidden';
  $('editStory').href = '/write/?id=' + id;
  $('storyContent').hidden = false;
  renderLike();
  const published = post.status === 'published';
  $('storyInteractions').hidden = !published;
  $('comments').hidden = !published;
  $('storyPrivate').hidden = published;
  $('storyPrivate').textContent =
    post.status === 'hidden'
      ? 'Bài đang được quản trị viên ẩn.'
      : 'Đây là bản nháp, chỉ bạn có thể xem.';
  $('commentForm').hidden = !customer;
  $('commentLogin').hidden = Boolean(customer);
  $('commentLoginLink').href =
    '/login/?next=' + encodeURIComponent('/story/?id=' + id + '#comments');
  $('storyStatus').textContent = '';
  if (published) await loadComments();
} catch (error) {
  $('storyStatus').textContent = error.message;
}
