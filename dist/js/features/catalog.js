import { galleryHTML, initGallery } from '../components/product-gallery.js';
import { products } from '../data/products.js';
import { $, formatMoney } from '../utils/dom.js';
import { renderProductArt } from '../components/artwork.js';
import { safeProduct } from '../utils/html.js';
import { backendAvailable } from '../config/shop.js';
let filter = 'all';
export function setFilter(value) {
  filter = value;
}
export function renderCatalog() {
  const q = $('search').value.trim().toLocaleLowerCase('vi');
  let shown = products.filter(
    (p) =>
      (filter === 'all' ||
        (filter === 'handmade'
          ? p.kind === 'handmade'
          : p.type === filter && p.kind !== 'handmade')) &&
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
              ${backendAvailable && p.stock === 0 ? '<span class="stock-note">Tạm hết hàng</span>' : ''}
            </div>
            <button
              class="product-view-link"
              data-detail="${p.id}"
              aria-label="Xem chi tiết ${p.name}"
            >
              Xem <span aria-hidden="true">↗</span>
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
  const soldOut = backendAvailable && p.stock === 0;
  $('detailContent').innerHTML = /* HTML */ `<div class="detailgrid">
    ${galleryHTML(p)}
    <div>
      <h2 id="detailTitle">${p.name}</h2>
      <div class="price">${formatMoney(p.price)}</div>
      <p>
        ${p.kind === 'handmade' ? 'Sản phẩm do mình tự tay đan móc. Nhắn mình để hỏi chi tiết hoặc đặt làm theo màu sắc, kích thước bạn muốn.' : p.type === 'tools' ? 'Một chiếc kim cho những hàng móc nhỏ. Liên hệ mình để xác nhận kích thước và loại cán trước khi mua.' : 'Một màu sắc dành cho dự án thủ công của bạn. Tham khảo ảnh thực tế, thành phần sợi và cỡ kim với mình trước khi chọn.'}
      </p>
      <dl>
        <dt>Mã sản phẩm</dt>
        <dd>TL-${String(p.id).padStart(3, '0')}</dd>
        <dt>Loại</dt>
        <dd>
          ${p.kind === 'handmade' ? 'Đồ len thủ công' : p.type === 'cotton' ? 'Cotton' : p.type === 'milk' ? 'Milk cotton' : 'Phụ kiện'}
        </dd>
        <dt>Mô tả / quy cách</dt>
        <dd>${p.desc}</dd>
        <dt>Tình trạng</dt>
        <dd>
          ${soldOut ? 'Tạm hết hàng' : backendAvailable ? `Còn ${p.stock} sản phẩm` : 'Bản xem giao diện'}
        </dd>
      </dl>
      <div class="detail-contact-box">
        <p>Thích món đồ này? Nhắn mình để hỏi mua hoặc đặt làm theo yêu cầu.</p>
        <a class="primary" id="detailContact" href="/contact/"
          ><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1.5-6A8 8 0 1 1 21 11Z" />
          </svg>
          Nhắn mình nhé</a
        >
        <p class="help">
          Gửi mình mã <strong>TL-${String(p.id).padStart(3, '0')}</strong> để trao đổi sản phẩm, giá
          và giao hàng nhé.
        </p>
      </div>
    </div>
  </div>`;
  $('detailContact').onclick = () => $('detail').close();
  $('detail').showModal();
  initGallery($('detailContent'), $('detail'));
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
  };
  $('closeDetail').onclick = () => $('detail').close();
  renderCatalog();
}
