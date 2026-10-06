import { initCommunityPreview } from './features/community-preview.js';
import { renderHero } from './components/artwork.js';
import { initCatalog } from './features/catalog.js';
import { initCart } from './features/cart.js';
import { initContact } from './features/contact.js';
import { initOrder } from './features/order.js';
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
    'Đây là bản xem giao diện. Đặt hàng trực tiếp cần website chạy cùng backend.';
}
try {
  await loadCustomerSession();
} catch {
  /* Yêu cầu đăng nhập khi không xác minh được phiên. */
}
renderHero();
initOrder();
initContact();
initCatalog();
initCart();
const accountLink = document.getElementById('customerLink');
if (accountLink && customer) {
  accountLink.textContent = 'Góc của tôi';
  accountLink.href = '/account/';
}

initCommunityPreview();
