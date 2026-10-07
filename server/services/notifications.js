export function notifyInteraction(db, { kind, post, actorId, commentId = null }) {
  if (post.author_id === actorId) return;
  const key = kind === 'like' ? `like:${post.id}:${actorId}` : `comment:${commentId}`;
  db.prepare(
    'INSERT OR IGNORE INTO notifications(customer_id,kind,actor_id,post_id,comment_id,event_key) VALUES(?,?,?,?,?,?)',
  ).run(post.author_id, kind, actorId, post.id, commentId, key);
}
export const notificationFrom = `FROM notifications n
  LEFT JOIN posts p ON p.id=n.post_id
  LEFT JOIN post_comments c ON c.id=n.comment_id
  LEFT JOIN customers actor ON actor.id=n.actor_id
  LEFT JOIN announcements a ON a.id=n.announcement_id
  WHERE n.customer_id=? AND (n.kind='announcement' OR
    (p.status='published' AND (n.kind='like' OR c.hidden=0)))`;
export function unreadCount(db, customerId) {
  return db
    .prepare('SELECT COUNT(*) AS n ' + notificationFrom + ' AND n.read_at IS NULL')
    .get(customerId).n;
}
export function publicNotification(row) {
  const name = row.actor_name || 'Một thành viên';
  const action = row.kind === 'like' ? 'đã thả tim' : 'đã bình luận về';
  return {
    id: row.id,
    kind: row.kind,
    title:
      row.kind === 'announcement'
        ? row.title
        : row.kind === 'like'
          ? 'Một trái tim mới'
          : 'Có lời chia sẻ mới',
    body:
      row.kind === 'announcement'
        ? row.body
        : `${name} ${action} câu chuyện “${row.post_title}” của bạn.`,
    href:
      row.kind === 'announcement'
        ? null
        : '/story/?id=' + row.post_id + (row.kind === 'comment' ? '#comments' : ''),
    read: row.read_at !== null,
    createdAt: row.created_at,
  };
}
