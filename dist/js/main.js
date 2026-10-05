import { renderHero } from './components/artwork.js';
import { initCatalog } from './features/catalog.js';
import { initCart } from './features/cart.js';
import { initContact } from './features/contact.js';
import { initOrder } from './features/order.js';

renderHero();
initOrder();
initContact();
initCatalog();
initCart();
