import { initCommunityPreview } from './features/community-preview.js';
import { renderHero } from './components/artwork.js';
import { initCatalog } from './features/catalog.js';
import { loadProducts, setProducts } from './data/products.js';
import { products as sampleProducts } from './data/sample-products.js';
import { shop, setBackendAvailable } from './config/shop.js';
import { loadCustomerSession, customer } from './services/customer.js';
import { api } from './services/api.js';
try {
  const [, settings] = await Promise.all([loadProducts(), api('/settings')]);
  Object.assign(shop, settings);
  setBackendAvailable(true);
} catch {
  setProducts(sampleProducts.map((p) => ({ ...p, stock: 0 })));
  document.getElementById('serviceStatus').textContent =
    'Không kết nối được cửa hàng. Danh sách đang hiển thị dữ liệu mẫu; vui lòng ghé lại sau.';
}
try {
  await loadCustomerSession();
} catch {
  /* Yêu cầu đăng nhập khi không xác minh được phiên. */
}
renderHero();
if (shop.name) {
  document.title = shop.name + ' • Một chút len, nhiều thương yêu';
  document.querySelector('.logo').lastChild.textContent = ' ' + shop.name;
}
if (shop.demo) {
  const note = document.createElement('p');
  note.className = 'demo-note';
  note.textContent =
    'Bản trưng bày mẫu: hình minh họa, sản phẩm và giá cần được shop cập nhật trước khi bán.';
  const section = document.getElementById('san-pham');
  section.insertBefore(note, section.firstChild);
}
initCatalog();
const accountLink = document.getElementById('customerLink');
if (accountLink && customer) {
  accountLink.textContent = 'Góc của tôi';
  accountLink.href = '/account/';
}

initCommunityPreview();
