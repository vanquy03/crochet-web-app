import { api } from '../services/api.js';
import { customer, loadCustomerSession, loginRequired } from '../services/customer.js';
import { storyCard, communityRequest, updateMemberLink } from '../components/community.js';
const $ = (id) => document.getElementById(id);
const mine = new URLSearchParams(location.search).get('mine') === '1';
let page = 1,
  pages = 1,
  category = '',
  requestId = 0,
  searchTimer;
async function loadFeed() {
  const current = ++requestId;
  $('feedStatus').textContent = 'Đang mở những câu chuyện…';
  $('feedPrevious').disabled = $('feedNext').disabled = true;
  const query = new URLSearchParams({ page: String(page) });
  if (category) query.set('category', category);
  if ($('storySearch').value.trim()) query.set('q', $('storySearch').value.trim());
  try {
    const result = await (mine ? communityRequest : api)(
      (mine ? '/customer/posts?' : '/community/posts?') + query,
    );
    if (current !== requestId) return;
    page = result.page;
    pages = result.pages;
    $('storyFeed').innerHTML =
      result.posts.map((post) => storyCard(post, mine)).join('') ||
      '<div class="community-empty"><h2>' +
        (mine ? 'Câu chuyện đầu tiên đang chờ bạn' : 'Chưa có câu chuyện phù hợp') +
        '</h2><p class="help">' +
        (mine
          ? 'Một mũi len mới học, một món quà vừa xong — điều nhỏ nào cũng đáng được kể.'
          : 'Thử một chủ đề hoặc từ khóa khác nhé.') +
        '</p><a class="primary" href="/write/">Viết một câu chuyện</a></div>';
    $('feedStatus').textContent = '';
    $('feedCount').textContent = result.total + ' câu chuyện';
    $('feedPage').textContent = 'Trang ' + page + ' / ' + pages;
    $('feedPagination').hidden = pages <= 1;
  } catch (error) {
    if (current === requestId) $('feedStatus').textContent = error.message;
  } finally {
    if (current === requestId) {
      $('feedPrevious').disabled = page <= 1;
      $('feedNext').disabled = page >= pages;
    }
  }
}
document.querySelectorAll('[data-topic]').forEach((button) => {
  button.onclick = () => {
    category = button.dataset.topic;
    page = 1;
    document.querySelectorAll('[data-topic]').forEach((item) => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    loadFeed();
  };
});
$('storySearch').oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page = 1;
    loadFeed();
  }, 250);
};
$('feedPrevious').onclick = () => {
  if (page > 1) {
    page--;
    loadFeed();
  }
};
$('feedNext').onclick = () => {
  if (page < pages) {
    page++;
    loadFeed();
  }
};
$('storyFeed').onclick = async (event) => {
  const button = event.target.closest('[data-remove-post]');
  if (!button || !confirm('Gỡ câu chuyện này khỏi cộng đồng?')) return;
  button.disabled = true;
  try {
    await communityRequest('/community/posts/' + button.dataset.removePost, {
      method: 'DELETE',
      body: '{}',
    });
    await loadFeed();
  } catch (error) {
    $('feedStatus').textContent = error.message;
    button.disabled = false;
  }
};
try {
  await loadCustomerSession();
  updateMemberLink(customer);
  if (mine && loginRequired('/community/?mine=1')) {
    /* Quay lại sau đăng nhập. */
  } else {
    if (mine) {
      $('feedTitle').textContent = 'Những câu chuyện của bạn';
      $('feedIntro').textContent = 'Nơi cất giữ bài đã chia sẻ và những dòng còn viết dở.';
    }
    $('joinCommunity').hidden = Boolean(customer) || mine;
    await loadFeed();
  }
} catch (error) {
  $('feedStatus').textContent = error.message;
}
