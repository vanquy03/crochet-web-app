import { api } from '../services/api.js';
import { customer, loadCustomerSession, loginRequired } from '../services/customer.js';
import { communityRequest, updateMemberLink } from '../components/community.js';
const $ = (id) => document.getElementById(id);
const id = Number(new URLSearchParams(location.search).get('id'));
let editing = null,
  coverUrl = '',
  busy = false,
  uploading = false;
function updateCover() {
  $('coverPreview').hidden = !coverUrl;
  $('coverPreview').src = coverUrl;
  $('removeCover').hidden = !coverUrl;
}
$('removeCover').onclick = () => {
  coverUrl = '';
  $('coverFile').value = '';
  updateCover();
};
$('postContent').oninput = () => {
  $('characterCount').textContent = $('postContent').value.length + ' / 8000 ký tự';
};
$('coverFile').onchange = async () => {
  const file = $('coverFile').files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    $('writeStatus').textContent = 'Ảnh tối đa 5 MB.';
    return;
  }
  uploading = true;
  $('saveDraft').disabled = $('publishStory').disabled = true;
  $('writeStatus').textContent = 'Đang tải ảnh…';
  try {
    const form = new FormData();
    form.append('image', file);
    const result = await communityRequest('/community/uploads', { method: 'POST', body: form });
    coverUrl = result.imageUrl;
    updateCover();
    $('writeStatus').textContent = 'Ảnh đã được thêm.';
  } catch (error) {
    $('writeStatus').textContent = error.message;
  } finally {
    uploading = false;
    $('saveDraft').disabled = $('publishStory').disabled = false;
  }
};
$('writeForm').onsubmit = async (event) => {
  event.preventDefault();
  if (busy || uploading || !$('writeForm').reportValidity()) return;
  busy = true;
  $('saveDraft').disabled = $('publishStory').disabled = true;
  const status = event.submitter?.value === 'draft' ? 'draft' : 'published';
  $('writeStatus').textContent =
    status === 'draft' ? 'Đang cất bản nháp…' : 'Đang chia sẻ câu chuyện…';
  try {
    const body = {
      title: $('postTitle').value.trim(),
      category: $('postCategory').value,
      excerpt: $('postExcerpt').value.trim(),
      content: $('postContent').value.trim(),
      coverUrl,
      status,
      ...(editing ? { version: editing.version } : {}),
    };
    const result = await communityRequest('/community/posts' + (editing ? '/' + editing.id : ''), {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    location.assign(status === 'draft' ? '/community/?mine=1' : '/story/?id=' + result.id);
  } catch (error) {
    $('writeStatus').textContent = error.message;
  } finally {
    busy = false;
    $('saveDraft').disabled = $('publishStory').disabled = false;
  }
};
try {
  await loadCustomerSession();
  updateMemberLink(customer);
  if (!loginRequired(location.pathname + location.search)) {
    if (id) {
      editing = await api('/community/posts/' + id);
      if (!editing.mine || editing.status === 'hidden')
        throw new Error('Bạn chỉ có thể sửa bài viết của mình khi bài không bị ẩn.');
      $('writeTitle').textContent = 'Viết tiếp câu chuyện của bạn';
      $('postTitle').value = editing.title;
      $('postCategory').value = editing.category;
      $('postExcerpt').value = editing.excerpt;
      $('postContent').value = editing.content;
      coverUrl = editing.coverUrl;
      updateCover();
    }
    $('writeForm').hidden = false;
    $('postContent').oninput();
    $('writeStatus').textContent = '';
  }
} catch (error) {
  $('writeStatus').textContent = error.message;
}
