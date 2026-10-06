import { api } from '../services/api.js';
import { customer, loadCustomerSession, loginRequired } from '../services/customer.js';
import { communityRequest, updateMemberLink, topicLabels } from '../components/community.js';
const $ = (id) => document.getElementById(id);
const id = Number(new URLSearchParams(location.search).get('id'));
let editing = null,
  coverUrl = '',
  busy = false,
  uploading = false,
  saved = '',
  ready = false;
function values() {
  return {
    title: $('postTitle').value.trim(),
    category: $('postCategory').value,
    excerpt: $('postExcerpt').value.trim(),
    content: $('postContent').value.trim(),
    coverUrl,
  };
}
function snapshot() {
  return JSON.stringify(values());
}
function changed() {
  if (!ready) return;
  $('draftState').textContent =
    snapshot() === saved ? 'Đã lưu các thay đổi' : 'Có thay đổi chưa lưu';
}
function resize(element) {
  element.style.height = 'auto';
  element.style.height = element.scrollHeight + 'px';
}
function updateCount() {
  const content = $('postContent').value;
  $('characterCount').textContent = content.length + ' / 8000 ký tự';
  $('readingTime').textContent =
    'Khoảng ' +
    Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200)) +
    ' phút đọc';
  resize($('postContent'));
  resize($('postTitle'));
}
function lock() {
  $('writeForm')
    .querySelectorAll('button,input,textarea,select')
    .forEach((field) => (field.disabled = busy || uploading));
}
function updateCover() {
  $('coverPreview').hidden = !coverUrl;
  if (coverUrl) $('coverPreview').src = coverUrl;
  else $('coverPreview').removeAttribute('src');
  $('removeCover').hidden = !coverUrl;
  $('coverUploadLabel').textContent = coverUrl ? 'Thay ảnh bìa' : 'Chọn ảnh từ thiết bị';
  changed();
}
$('removeCover').onclick = () => {
  coverUrl = '';
  $('coverFile').value = '';
  updateCover();
};
$('writeForm').oninput = (event) => {
  event.target.setCustomValidity?.('');
  updateCount();
  changed();
};
$('postCategory').onchange = changed;
$('coverFile').onchange = async () => {
  const file = $('coverFile').files[0];
  if (!file || busy || uploading) return;
  if (
    file.size > 5 * 1024 * 1024 ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
  ) {
    $('writeStatus').textContent = 'Chọn ảnh PNG, JPG hoặc WebP, tối đa 5 MB.';
    $('coverFile').value = '';
    return;
  }
  uploading = true;
  lock();
  $('writeStatus').textContent = 'Đang tải ảnh…';
  try {
    const form = new FormData();
    form.append('image', file);
    const result = await communityRequest('/community/uploads', { method: 'POST', body: form });
    coverUrl = result.imageUrl;
    updateCover();
    $('writeStatus').textContent = 'Ảnh đã được thêm. Lưu bài để giữ ảnh bìa.';
  } catch (error) {
    $('writeStatus').textContent = error.message;
  } finally {
    uploading = false;
    lock();
    $('coverFile').value = '';
  }
};
$('previewStory').onclick = () => {
  const data = values();
  $('previewTitle').textContent = data.title || 'Câu chuyện chưa đặt tên';
  $('previewCategory').textContent = topicLabels[data.category];
  $('previewAuthor').textContent = customer.name;
  $('previewExcerpt').textContent = data.excerpt || data.content.slice(0, 180);
  $('previewContent').textContent = data.content || 'Câu chuyện của bạn sẽ xuất hiện ở đây…';
  $('previewCover').hidden = !coverUrl;
  if (coverUrl) $('previewCover').src = coverUrl;
  else $('previewCover').removeAttribute('src');
  $('storyPreview').showModal();
};
$('closePreview').onclick = () => $('storyPreview').close();
$('writeForm').onsubmit = async (event) => {
  event.preventDefault();
  if (busy || uploading) return;
  const status =
    event.submitter?.value === 'draft' && editing?.status !== 'published' ? 'draft' : 'published';
  const data = values();
  if (status === 'published') {
    $('postTitle').setCustomValidity(
      data.title.length < 3 ? 'Đặt tiêu đề từ 3 ký tự trước khi chia sẻ nhé.' : '',
    );
    $('postContent').setCustomValidity(
      data.content.length < 20 ? 'Viết ít nhất 20 ký tự trước khi chia sẻ nhé.' : '',
    );
    if (!$('writeForm').reportValidity()) return;
  }
  busy = true;
  lock();
  $('writeStatus').textContent =
    status === 'draft' ? 'Đang lưu bản nháp…' : 'Đang chia sẻ câu chuyện…';
  try {
    const result = await communityRequest('/community/posts' + (editing ? '/' + editing.id : ''), {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify({ ...data, status, ...(editing ? { version: editing.version } : {}) }),
    });
    editing = result;
    saved = snapshot();
    history.replaceState(null, '', '/write/?id=' + result.id);
    $('draftState').textContent =
      'Đã lưu lúc ' +
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    $('writeStatus').textContent =
      status === 'draft'
        ? 'Bản nháp đã lưu. Bạn có thể viết tiếp hoặc quay lại sau.'
        : 'Đã lưu câu chuyện.';
    if (status === 'published') location.assign('/story/?id=' + result.id);
  } catch (error) {
    $('writeStatus').textContent = error.message;
    $('writeStatus').scrollIntoView({ block: 'center', behavior: 'auto' });
  } finally {
    busy = false;
    lock();
  }
};
window.addEventListener('resize', () => {
  if (ready) updateCount();
});
document.fonts.ready.then(() => {
  if (ready) updateCount();
});
window.addEventListener('beforeunload', (event) => {
  if (ready && (uploading || snapshot() !== saved)) {
    event.preventDefault();
    event.returnValue = '';
  }
});
try {
  await loadCustomerSession();
  updateMemberLink(customer);
  if (!loginRequired(location.pathname + location.search)) {
    if (id) {
      editing = await api('/community/posts/' + id);
      if (!editing.mine || editing.status === 'hidden')
        throw new Error('Bạn chỉ có thể sửa bài viết của mình khi bài không bị ẩn.');
      $('writeTitle').textContent = 'Viết tiếp câu chuyện của bạn';
      $('postTitle').value =
        editing.title === 'Câu chuyện chưa đặt tên' && editing.status === 'draft'
          ? ''
          : editing.title;
      $('postCategory').value = editing.category;
      $('postExcerpt').value = editing.excerpt;
      $('postContent').value = editing.content;
      coverUrl = editing.coverUrl;
      updateCover();
      if (editing.status === 'published') {
        $('saveDraft').textContent = 'Lưu thay đổi';
        $('publishStory').textContent = 'Cập nhật bài';
      }
    }
    $('writeForm').hidden = false;
    updateCount();
    saved = snapshot();
    ready = true;
    $('draftState').textContent = editing ? 'Đã tải bài viết' : 'Bản nháp mới';
    $('writeStatus').textContent = '';
  }
} catch (error) {
  $('writeStatus').textContent = error.message;
}
