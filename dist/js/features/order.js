import { initCheckout } from './checkout.js';
import { products } from '../data/products.js';
import { shop } from '../config/shop.js';
import { $, formatMoney, showToast } from '../utils/dom.js';
import { cartItems } from './cart.js';
export function createOrderText() {
  return (
    `DANH SÁCH CHỌN HÀNG — ${shop.name || 'Nhung Cap'}${shop.demo ? ' (BẢN MẪU)' : ''}\n` +
    products
      .filter((p) => cartItems[p.id])
      .map(
        (p) =>
          `TL-${String(p.id).padStart(3, '0')} | ${p.name} × ${cartItems[p.id]}: ${formatMoney(p.price * cartItems[p.id])}`,
      )
      .join('\n') +
    '\nTạm tính: ' +
    $('total').textContent +
    '\nTên: ' +
    ($('buyerName').value.trim() || 'Chưa cung cấp') +
    '\nLời nhắn: ' +
    ($('buyerNote').value.trim() || 'Không có') +
    '\nVui lòng xác nhận tồn kho, phí giao hàng và cách thanh toán.'
  );
}
export async function copyOrder() {
  try {
    await navigator.clipboard.writeText(createOrderText());
    showToast('Đã sao chép. Dán danh sách vào cuộc trò chuyện với mình.');
    return true;
  } catch {
    showToast('Trình duyệt không cho sao chép. Hãy tải danh sách để gửi mình.');
    return false;
  }
}
export function initOrder() {
  $('copy').onclick = copyOrder;
  $('download').onclick = () => {
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + createOrderText()], { type: 'text/plain;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'danh-sach-len.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  initCheckout();
}
