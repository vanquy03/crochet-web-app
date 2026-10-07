import { notifyInteraction } from '../services/notifications.js';
import { rateLimit } from 'express-rate-limit';
import { requireCustomer, findCustomerSession } from './customers.js';
import { imageUpload } from '../uploads.js';
import { transaction } from '../database.js';
import { text, integer, HttpError } from '../validation.js';
import {
  categories,
  postInput,
  postSelect,
  publicPost,
  readPost,
  publishedPost,
  pagination,
} from '../services/community.js';

export function registerCommunityRoutes(app, { db, uploadDir }) {
  const authenticate = requireCustomer(db);
  const writeLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Bạn gửi nhiều tương tác liên tiếp. Nghỉ một chút rồi quay lại nhé.' },
  });
  const viewer = (req) => findCustomerSession(db, req)?.customer_id ?? null;
  const postId = (req) => integer(Number(req.params.id), 'Mã bài viết', 1);
  function listPosts(req, res, mine = false) {
    const viewerId = mine ? req.customer.customer_id : viewer(req);
    const where = [mine ? "p.author_id=? AND p.status!='deleted'" : "p.status='published'"];
    const args = mine ? [viewerId] : [];
    if (req.query.category) {
      if (!Object.hasOwn(categories, req.query.category))
        throw new HttpError(400, 'Chủ đề không hợp lệ.');
      where.push('p.category=?');
      args.push(req.query.category);
    }
    if (req.query.q) {
      const q = text(req.query.q, 'Từ khóa', 1, 100);
      where.push('(p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)');
      args.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
    }
    const total = db
      .prepare('SELECT COUNT(*) AS n FROM posts p WHERE ' + where.join(' AND '))
      .get(...args).n;
    const paging = pagination(req.query, total);
    const posts = db
      .prepare(
        postSelect +
          ' WHERE ' +
          where.join(' AND ') +
          ' ORDER BY ' +
          (mine ? 'p.updated_at' : 'p.published_at') +
          ' DESC,p.id DESC LIMIT 9 OFFSET ?',
      )
      .all(viewerId, ...args, (paging.page - 1) * 9)
      .map((row) => publicPost(row, viewerId));
    res.json({ posts, ...paging });
  }
  app.get('/api/community/posts', (req, res) => listPosts(req, res));
  app.get('/api/customer/posts', authenticate, (req, res) => listPosts(req, res, true));
  app.get('/api/community/posts/:id', (req, res) =>
    res.json(readPost(db, postId(req), viewer(req))),
  );
  app.post('/api/community/uploads', authenticate, writeLimit, ...imageUpload(uploadDir));
  app.post('/api/community/posts', authenticate, writeLimit, (req, res) => {
    const data = postInput(req.body);
    const result = db
      .prepare(
        "INSERT INTO posts(author_id,title,excerpt,content,category,cover_url,status,published_at) VALUES(?,?,?,?,?,?,?,CASE WHEN ?='published' THEN CURRENT_TIMESTAMP ELSE NULL END)",
      )
      .run(
        req.customer.customer_id,
        data.title,
        data.excerpt,
        data.content,
        data.category,
        data.coverUrl,
        data.status,
        data.status,
      );
    res.status(201).json(readPost(db, Number(result.lastInsertRowid), req.customer.customer_id));
  });
  app.put('/api/community/posts/:id', authenticate, writeLimit, (req, res) => {
    const id = postId(req),
      data = postInput(req.body);
    const version = integer(req.body.version, 'Phiên bản bài viết');
    transaction(db, () => {
      const old = db
        .prepare("SELECT * FROM posts WHERE id=? AND author_id=? AND status!='deleted'")
        .get(id, req.customer.customer_id);
      if (!old) throw new HttpError(404, 'Không tìm thấy bài viết của bạn.');
      if (old.status === 'hidden')
        throw new HttpError(403, 'Bài viết đang được quản trị viên ẩn. Vui lòng nhắn mình.');
      if (old.version !== version)
        throw new HttpError(409, 'Bài viết đã thay đổi. Tải lại bài trước khi sửa tiếp.');
      db.prepare(
        "UPDATE posts SET title=?,excerpt=?,content=?,category=?,cover_url=?,status=?,version=version+1,updated_at=CURRENT_TIMESTAMP,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END WHERE id=?",
      ).run(
        data.title,
        data.excerpt,
        data.content,
        data.category,
        data.coverUrl,
        data.status,
        data.status,
        id,
      );
    });
    res.json(readPost(db, id, req.customer.customer_id));
  });
  app.delete('/api/community/posts/:id', authenticate, writeLimit, (req, res) => {
    const result = db
      .prepare(
        "UPDATE posts SET status='deleted',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND author_id=? AND status!='deleted'",
      )
      .run(postId(req), req.customer.customer_id);
    if (!result.changes) throw new HttpError(404, 'Không tìm thấy bài viết của bạn.');
    res.json({ ok: true });
  });
  app.put('/api/community/posts/:id/like', authenticate, writeLimit, (req, res) => {
    const id = postId(req);
    if (typeof req.body.liked !== 'boolean')
      throw new HttpError(400, 'Trạng thái thả tim không hợp lệ.');
    transaction(db, () => {
      const target = publishedPost(db, id);
      if (req.body.liked) {
        const inserted = db
          .prepare('INSERT OR IGNORE INTO post_likes(post_id,customer_id) VALUES(?,?)')
          .run(id, req.customer.customer_id);
        if (inserted.changes)
          notifyInteraction(db, { kind: 'like', post: target, actorId: req.customer.customer_id });
      } else
        db.prepare('DELETE FROM post_likes WHERE post_id=? AND customer_id=?').run(
          id,
          req.customer.customer_id,
        );
    });
    const post = readPost(db, id, req.customer.customer_id);
    res.json({ liked: post.liked, likesCount: post.likesCount });
  });
  function listComments(req, res, admin = false) {
    const id = postId(req);
    if (!admin) publishedPost(db, id);
    else if (!db.prepare("SELECT id FROM posts WHERE id=? AND status!='deleted'").get(id))
      throw new HttpError(404, 'Không tìm thấy bài viết.');
    const viewerId = viewer(req);
    const clause = admin ? '' : ' AND hidden=0';
    const total = db
      .prepare('SELECT COUNT(*) AS n FROM post_comments WHERE post_id=?' + clause)
      .get(id).n;
    const paging = pagination(req.query, total, 20);
    const comments = db
      .prepare(
        'SELECT m.id,m.content,m.created_at,m.hidden,c.id AS author_id,c.name AS author_name FROM post_comments m JOIN customers c ON c.id=m.customer_id WHERE post_id=?' +
          clause +
          ' ORDER BY m.id DESC LIMIT 20 OFFSET ?',
      )
      .all(id, (paging.page - 1) * 20)
      .map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        hidden: Boolean(row.hidden),
        author: { id: row.author_id, name: row.author_name },
        mine: row.author_id === viewerId,
      }));
    res.json({ comments, ...paging });
  }
  app.get('/api/community/posts/:id/comments', (req, res) => listComments(req, res));
  app.post('/api/community/posts/:id/comments', authenticate, writeLimit, (req, res) => {
    const id = postId(req);
    const content = text(req.body.content, 'Bình luận', 2, 1500);
    const result = transaction(db, () => {
      const target = publishedPost(db, id);
      const inserted = db
        .prepare('INSERT INTO post_comments(post_id,customer_id,content) VALUES(?,?,?)')
        .run(id, req.customer.customer_id, content);
      notifyInteraction(db, {
        kind: 'comment',
        post: target,
        actorId: req.customer.customer_id,
        commentId: Number(inserted.lastInsertRowid),
      });
      return inserted;
    });
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.delete(
    '/api/community/posts/:id/comments/:commentId',
    authenticate,
    writeLimit,
    (req, res) => {
      const id = postId(req),
        commentId = integer(Number(req.params.commentId), 'Mã bình luận', 1);
      publishedPost(db, id);
      const result = db
        .prepare(
          'UPDATE post_comments SET hidden=1 WHERE id=? AND post_id=? AND customer_id=? AND hidden=0',
        )
        .run(commentId, id, req.customer.customer_id);
      if (!result.changes) throw new HttpError(404, 'Không tìm thấy bình luận của bạn.');
      res.json({ ok: true });
    },
  );
  // Registered after the admin session middleware in app.js.
  app.get('/api/admin/community/posts', (req, res) => {
    const total = db
      .prepare("SELECT COUNT(*) AS n FROM posts WHERE status IN ('published','hidden')")
      .get().n;
    const paging = pagination(req.query, total, 20);
    const posts = db
      .prepare(
        postSelect +
          " WHERE p.status IN ('published','hidden') ORDER BY p.updated_at DESC,p.id DESC LIMIT 20 OFFSET ?",
      )
      .all(null, (paging.page - 1) * 20)
      .map((row) => publicPost(row, null));
    res.json({ posts, ...paging });
  });
  app.patch('/api/admin/community/posts/:id', (req, res) => {
    const id = postId(req),
      version = integer(req.body.version, 'Phiên bản bài viết');
    if (typeof req.body.hidden !== 'boolean')
      throw new HttpError(400, 'Trạng thái ẩn không hợp lệ.');
    transaction(db, () => {
      const row = db
        .prepare("SELECT * FROM posts WHERE id=? AND status IN ('published','hidden')")
        .get(id);
      if (!row) throw new HttpError(404, 'Không tìm thấy bài viết công khai.');
      if (row.version !== version)
        throw new HttpError(409, 'Bài viết đã thay đổi. Tải lại danh sách.');
      db.prepare(
        'UPDATE posts SET status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?',
      ).run(req.body.hidden ? 'hidden' : 'published', id);
    });
    res.json({ ok: true });
  });
  app.get('/api/admin/community/posts/:id/comments', (req, res) => listComments(req, res, true));
  app.delete('/api/admin/community/posts/:id/comments/:commentId', (req, res) => {
    const result = db
      .prepare('UPDATE post_comments SET hidden=1 WHERE id=? AND post_id=? AND hidden=0')
      .run(integer(Number(req.params.commentId), 'Mã bình luận', 1), postId(req));
    if (!result.changes) throw new HttpError(404, 'Không tìm thấy bình luận.');
    res.json({ ok: true });
  });
}
