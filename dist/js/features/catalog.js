import { products } from '../data/products.js';
import { $, formatMoney } from '../utils/dom.js';
import { renderProductArt } from '../components/artwork.js';
import { safeProduct } from '../utils/html.js';
import { backendAvailable } from '../config/shop.js';
import { addToCart } from './cart.js';
let filter = 'all';
export function setFilter(value) {
  filter = value;
}
export function renderCatalog() {
  const q = $('search').value.trim().toLocaleLowerCase('vi');
  let shown = products.filter(
    (p) =>
      (filter === 'all' || p.type === filter) &&
      (p.name + ' ' + p.desc).toLocaleLowerCase('vi').includes(q),
  );
  if ($('sort').value === 'asc') shown.sort((a, b) => a.price - b.price);
  if ($('sort').value === 'desc') shown.sort((a, b) => b.price - a.price);
  $('products').innerHTML =
    shown
      .map((product) => {
        const p = safeProduct(product);
        return /* HTML */ `<article>
          <button
            class="productart productvisual"
            data-detail="${p.id}"
            style="--bg:${p.bg}"
            aria-label="Xem chi tiết ${p.name}"
          >
            ${renderProductArt(p)}${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
          </button>
          <div class="meta">
            <div>
              <h3><button class="producttitle" data-detail="${p.id}">${p.name}</button></h3>
              <p>${p.desc}</p>
            </div>
            <button
              class="add"
              data-add="${p.id}"
              aria-label="Thêm ${p.name} vào giỏ"
              ${backendAvailable && p.stock === 0 ? 'disabled' : ''}
            >
              +
            </button>
          </div>
          <div class="price">${formatMoney(p.price)}</div>
        </article>`;
      })
      .join('') || '<p class="empty">Chưa tìm thấy sản phẩm. Thử một từ khóa khác nhé.</p>';
}
export function showProductDetail(id) {
  const raw = products.find((p) => p.id === Number(id));
  const p = raw && safeProduct(raw);
  if (!p) return;
  $('detailContent').innerHTML = /* HTML */ `<div class="detailgrid">
    <div class="productart" style="--bg:${p.bg}">${renderProductArt(p, 'detail')}</div>
    <div>
      <h2 id="detailTitle">${p.name}</h2>
      <div class="price">${formatMoney(p.price)}</div>
      <p>
        ${p.type === 'tools' ? 'Một chiếc kim cho những hàng móc nhỏ. Liên hệ tiệm để xác nhận kích thước và loại cán trước khi mua.' : 'Một màu sắc dành cho dự án thủ công của bạn. Tham khảo ảnh thực tế, thành phần sợi và cỡ kim với tiệm trước khi chọn.'}
      </p>
      <dl>
        <dt>Mã sản phẩm</dt>
        <dd>TL-${String(p.id).padStart(3, '0')}</dd>
        <dt>Loại</dt>
        <dd>${p.type === 'cotton' ? 'Cotton' : p.type === 'milk' ? 'Milk cotton' : 'Phụ kiện'}</dd>
        <dt>Quy cách mẫu</dt>
        <dd>${p.desc}</dd>
        <dt>Tình trạng</dt>
        <dd>${backendAvailable ? `Còn ${p.stock} sản phẩm` : 'Bản xem giao diện'}</dd>
      </dl>
      <label class="help" for="detailQty">Số lượng</label>
      <div class="detailactions">
        <input
          class="detailqty"
          id="detailQty"
          type="number"
          min="1"
          max="${Math.min(99, p.stock || 0)}"
          value="1"
          required
        /><button class="primary" id="detailAdd">Thêm vào giỏ</button
        ><button class="secondary" id="detailBuy">Đặt hàng</button>
      </div>
      <p class="help">Màu có thể khác tùy màn hình. Vui lòng hỏi tiệm khi cần ảnh thực tế.</p>
    </div>
  </div>`;
  $('detailAdd').disabled = $('detailBuy').disabled = backendAvailable && p.stock === 0;
  $('detailAdd').onclick = () => {
    const input = $('detailQty');
    if (!input.reportValidity() || !Number.isInteger(input.valueAsNumber)) return;
    addToCart(p.id, input.valueAsNumber);
  };
  $('detailBuy').onclick = () => {
    const input = $('detailQty');
    if (!input.reportValidity() || !Number.isInteger(input.valueAsNumber)) return;
    addToCart(p.id, input.valueAsNumber);
    $('detail').close();
    $('cart').showModal();
  };
  $('detail').showModal();
}

export function initCatalog() {
  const filters = document.querySelectorAll('[data-filter]');
  filters.forEach((button) => {
    button.onclick = () => {
      setFilter(button.dataset.filter);
      filters.forEach((item) => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      renderCatalog();
    };
  });
  $('search').oninput = renderCatalog;
  $('sort').onchange = renderCatalog;
  $('products').onclick = (event) => {
    const detailButton = event.target.closest('[data-detail]');
    if (detailButton) {
      showProductDetail(detailButton.dataset.detail);
      return;
    }
    const addButton = event.target.closest('[data-add]');
    if (addButton) addToCart(addButton.dataset.add);
  };
  $('closeDetail').onclick = () => $('detail').close();
  renderCatalog();
}
