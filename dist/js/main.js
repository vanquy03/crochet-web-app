import { renderHero } from './components/artwork.js';
import { initCatalog } from './features/catalog.js';
import { initCart } from './features/cart.js';
import { initContact } from './features/contact.js';
import { initOrder } from './features/order.js';
import { loadProducts, setProducts } from './data/products.js';
import { products as sampleProducts } from './data/sample-products.js';
import { shop, setBackendAvailable } from './config/shop.js';
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
renderHero();
initOrder();
initContact();
initCatalog();
initCart();
