import { api } from '../services/api.js';
import { storyCard } from '../components/community.js';
export async function initCommunityPreview() {
  const container = document.getElementById('homeStories');
  const status = document.getElementById('homeStoriesStatus');
  if (!container) return;
  try {
    const result = await api('/community/posts');
    const posts = (result.posts || []).slice(0, 3);
    container.innerHTML = posts.map((post) => storyCard(post)).join('');
    status.textContent = posts.length
      ? ''
      : 'Câu chuyện đầu tiên đang chờ bạn. Ghé Góc chuyện len để bắt đầu nhé.';
  } catch {
    status.textContent = 'Góc chuyện len đang nghỉ một chút. Bạn có thể ghé lại sau nhé.';
  }
}
