export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function text(value, label, min = 0, max = 500) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new HttpError(400, `${label} không hợp lệ.`);
  return value.trim();
}
export function integer(value, label, min = 0, max = 100000000) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new HttpError(400, `${label} không hợp lệ.`);
  return value;
}
export function productInput(body) {
  const name = text(body.name, 'Tên sản phẩm', 2, 120);
  if (!['cotton', 'milk', 'tools'].includes(body.type))
    throw new HttpError(400, 'Loại sản phẩm không hợp lệ.');
  const color = text(body.color || '#c69592', 'Màu', 7, 7),
    bg = text(body.bg || '#f1e4df', 'Màu nền', 7, 7);
  if (!/^#[a-f0-9]{6}$/i.test(color) || !/^#[a-f0-9]{6}$/i.test(bg))
    throw new HttpError(400, 'Mã màu không hợp lệ.');
  const image = text(body.imageUrl || '', 'Ảnh', 0, 1000);
  validateMediaUrl(image, 'image');
  const media =
    body.media === undefined
      ? image
        ? [{ type: 'image', url: image, primary: true }]
        : []
      : body.media;
  if (!Array.isArray(media) || media.length > 12)
    throw new HttpError(400, 'Tối đa 12 ảnh/video cho mỗi sản phẩm.');
  const normalized = media.map((item) => {
    if (!item || !['image', 'video'].includes(item.type) || typeof item.primary !== 'boolean')
      throw new HttpError(400, 'Ảnh/video không hợp lệ.');
    const url = text(item.url, 'URL ảnh/video', 1, 1000);
    validateMediaUrl(url, item.type);
    if (item.primary && item.type !== 'image')
      throw new HttpError(400, 'Ảnh chính phải là hình ảnh.');
    return { type: item.type, url, primary: item.primary };
  });
  if (normalized.length && normalized.filter((item) => item.primary).length !== 1)
    throw new HttpError(400, 'Chọn duy nhất một ảnh chính.');
  if (new Set(normalized.map((item) => item.url)).size !== normalized.length)
    throw new HttpError(400, 'Ảnh/video không được trùng nhau.');
  if (typeof body.active !== 'boolean')
    throw new HttpError(400, 'Trạng thái sản phẩm không hợp lệ.');
  const kind = body.kind || 'supplies';
  if (!['supplies', 'handmade'].includes(kind))
    throw new HttpError(400, 'Nhóm sản phẩm không hợp lệ.');
  return [
    name,
    body.type,
    text(body.desc || '', 'Mô tả', 0, 2000),
    integer(body.price, 'Giá'),
    integer(body.stock, 'Tồn kho', 0, 1000000),
    color,
    bg,
    text(body.tag || '', 'Nhãn', 0, 80),
    normalized.find((item) => item.primary)?.url || '',
    Number(body.active),
    kind,
    JSON.stringify(normalized),
  ];
}
export function customerInput(body) {
  const name = text(body.name, 'Họ tên', 2, 80),
    phone = text(body.phone, 'Số điện thoại', 9, 16).replace(/[\s.-]/g, '');
  if (!/^(0\d{9}|\+84\d{9})$/.test(phone))
    throw new HttpError(400, 'Nhập số điện thoại Việt Nam hợp lệ.');
  const address = text(body.address, 'Địa chỉ', 10, 500),
    note = text(body.note || '', 'Lời nhắn', 0, 500);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50)
    throw new HttpError(400, 'Giỏ hàng không hợp lệ.');
  const items = body.items
    .map((item) => ({
      productId: integer(item.productId, 'Mã sản phẩm', 1),
      quantity: integer(item.quantity, 'Số lượng', 1, 99),
    }))
    .sort((a, b) => a.productId - b.productId);
  if (new Set(items.map((i) => i.productId)).size !== items.length)
    throw new HttpError(400, 'Sản phẩm bị lặp trong giỏ.');
  return { name, phone, address, note, items };
}

export function secret(value, label, min = 1, max = 200) {
  if (typeof value !== 'string' || value.length < min || value.length > max)
    throw new HttpError(400, label + ' không hợp lệ.');
  return value;
}

export function validateMediaUrl(value, type) {
  if (!value) return;
  if (
    type === 'image' &&
    ['/images/handmade-bag.svg', '/images/handmade-scarf.svg'].includes(value)
  )
    return;
  const local =
    type === 'image'
      ? /^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/
      : /^\/uploads\/[a-f0-9-]+\.(mp4|webm)$/;
  if (local.test(value)) return;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, 'URL ảnh/video không hợp lệ.');
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new HttpError(400, 'Ảnh/video phải dùng HTTPS.');
}
