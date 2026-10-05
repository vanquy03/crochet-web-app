import { randomUUID } from 'node:crypto';
import { transaction, getSettings } from '../database.js';
import { digest } from '../security.js';
import { customerInput, text, HttpError } from '../validation.js';

export function readOrder(db, id) {
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if (!row) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
  const { lookup_hash, idempotency_key, request_hash, ...order } = row;
  order.items = db
    .prepare('SELECT product_id,name,price,quantity FROM order_items WHERE order_id=?')
    .all(id);
  return order;
}
export function placeOrder(db, body, key) {
  const customer = customerInput(body);
  if (body.paymentMethod !== 'cod') throw new HttpError(400, 'Hiện chỉ hỗ trợ thanh toán COD.');
  if (!Number.isSafeInteger(body.expectedTotal) || body.expectedTotal < 0)
    throw new HttpError(400, 'Tổng thanh toán không hợp lệ.');
  key = text(key, 'Mã gửi đơn', 36, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))
    throw new HttpError(400, 'Mã gửi đơn không hợp lệ.');
  const requestHash = digest(JSON.stringify(customer));
  const token = digest('lookup:' + key);
  return transaction(db, () => {
    const existing = db
      .prepare('SELECT id,request_hash FROM orders WHERE idempotency_key=?')
      .get(key);
    if (existing) {
      if (existing.request_hash !== requestHash)
        throw new HttpError(409, 'Mã gửi đơn đã dùng cho nội dung khác.');
      return { order: readOrder(db, existing.id), lookupToken: token, replay: true };
    }
    const items = customer.items.map((item) => {
      const product = db
        .prepare('SELECT * FROM products WHERE id=? AND active=1')
        .get(item.productId);
      if (!product || product.stock < item.quantity)
        throw new HttpError(409, 'Sản phẩm đã hết hoặc không đủ số lượng. Vui lòng cập nhật giỏ.');
      return { ...item, name: product.name, price: product.price };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const settings = getSettings(db);
    const shippingFee =
      settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold
        ? 0
        : settings.shippingFee;
    if (body.expectedTotal !== subtotal + shippingFee)
      throw new HttpError(
        409,
        'Giá hoặc phí giao đã thay đổi. Kiểm tra tổng tiền mới rồi gửi lại.',
      );
    const id = 'TL-' + randomUUID();
    db.prepare(
      'INSERT INTO orders(id,lookup_hash,idempotency_key,request_hash,name,phone,address,note,subtotal,shipping_fee,total) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      digest(token),
      key,
      requestHash,
      customer.name,
      customer.phone,
      customer.address,
      customer.note,
      subtotal,
      shippingFee,
      subtotal + shippingFee,
    );
    for (const item of items) {
      const result = db
        .prepare(
          'UPDATE products SET stock=stock-?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=? AND active=1',
        )
        .run(item.quantity, item.productId, item.quantity);
      if (result.changes !== 1) throw new HttpError(409, 'Tồn kho vừa thay đổi. Vui lòng thử lại.');
      db.prepare(
        'INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES(?,?,?,?,?)',
      ).run(id, item.productId, item.name, item.price, item.quantity);
      db.prepare('INSERT INTO inventory_log(product_id,delta,reason,order_id) VALUES(?,?,?,?)').run(
        item.productId,
        -item.quantity,
        'order_reserved',
        id,
      );
    }
    return { order: readOrder(db, id), lookupToken: token, replay: false };
  });
}
export function updateOrder(db, id, status, paid) {
  const transitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipping', 'cancelled'],
    shipping: ['completed'],
    completed: [],
    cancelled: [],
  };
  return transaction(db, () => {
    const order = readOrder(db, id);
    if (
      !(status in transitions) ||
      (status !== order.status && !transitions[order.status].includes(status))
    )
      throw new HttpError(409, 'Không thể chuyển trạng thái đơn hàng theo bước này.');
    if (typeof paid !== 'boolean') throw new HttpError(400, 'Trạng thái thanh toán không hợp lệ.');
    if (status === 'completed' && !paid)
      throw new HttpError(400, 'Xác nhận đã thu tiền trước khi hoàn tất đơn.');
    if (status === 'cancelled' && order.paid)
      throw new HttpError(409, 'Xử lý hoàn tiền và bỏ đánh dấu đã thu trước khi hủy.');
    if (status === 'cancelled' && paid)
      throw new HttpError(400, 'Đơn hủy không thể đánh dấu đã thu tiền.');
    if (status === 'cancelled' && order.status !== 'cancelled')
      for (const item of order.items) {
        db.prepare(
          'UPDATE products SET stock=stock+?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?',
        ).run(item.quantity, item.product_id);
        db.prepare(
          'INSERT INTO inventory_log(product_id,delta,reason,order_id) VALUES(?,?,?,?)',
        ).run(item.product_id, item.quantity, 'order_cancelled', id);
      }
    db.prepare('UPDATE orders SET status=?,paid=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(
      status,
      Number(paid),
      id,
    );
    return readOrder(db, id);
  });
}
