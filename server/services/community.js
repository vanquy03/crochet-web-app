import { text, HttpError } from '../validation.js';
export const categories = {
  slow: 'Sống chậm',
  journey: 'Hành trình đan',
  memory: 'Kỷ niệm',
  tips: 'Mẹo nhỏ',
};
export function postInput(body) {
  const title = text(body.title, 'Tiêu đề', 3, 160);
  const content = text(body.content, 'Câu chuyện', 20, 8000);
  const excerpt = text(body.excerpt || '', 'Lời mở đầu', 0, 240);
  if (!Object.hasOwn(categories, body.category)) throw new HttpError(400, 'Chủ đề không hợp lệ.');
  if (!['draft', 'published'].includes(body.status))
    throw new HttpError(400, 'Trạng thái bài viết không hợp lệ.');
  const coverUrl = text(body.coverUrl || '', 'Ảnh bìa', 0, 200);
  if (coverUrl && !/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(coverUrl))
    throw new HttpError(400, 'Hãy tải ảnh bìa lên từ thiết bị của bạn.');
  return { title, content, excerpt, category: body.category, status: body.status, coverUrl };
}
export const postSelect = `SELECT p.*,c.name AS author_name,
  (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes_count,
  (SELECT COUNT(*) FROM post_comments m WHERE m.post_id=p.id AND m.hidden=0) AS comments_count,
  EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.customer_id=?) AS liked
  FROM posts p JOIN customers c ON c.id=p.author_id`;
export function publicPost(row, viewerId, full = false) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt || row.content.slice(0, 180),
    category: row.category,
    coverUrl: row.cover_url,
    status: row.status,
    version: row.version,
    author: { id: row.author_id, name: row.author_name },
    mine: row.author_id === viewerId,
    liked: Boolean(row.liked),
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    demo: Boolean(row.seed_key),
    ...(full ? { content: row.content } : {}),
  };
}
export function readPost(db, id, viewerId = null) {
  const row = db.prepare(postSelect + ' WHERE p.id=?').get(viewerId, id);
  if (
    !row ||
    row.status === 'deleted' ||
    (row.status !== 'published' && row.author_id !== viewerId)
  )
    throw new HttpError(404, 'Không tìm thấy câu chuyện này.');
  return publicPost(row, viewerId, true);
}
export function publishedPost(db, id) {
  const row = db.prepare("SELECT * FROM posts WHERE id=? AND status='published'").get(id);
  if (!row) throw new HttpError(404, 'Câu chuyện này hiện không được công khai.');
  return row;
}
export function pagination(query, total, size = 9) {
  const requested = Number(query.page || 1);
  if (!Number.isSafeInteger(requested) || requested < 1)
    throw new HttpError(400, 'Trang không hợp lệ.');
  const pages = Math.max(1, Math.ceil(total / size));
  return { page: Math.min(requested, pages), pages, total };
}
