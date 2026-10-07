import { api } from '../services/api.js';
import { shop } from '../config/shop.js';
import { initContact } from '../features/contact.js';
import { loadCustomerSession } from '../services/customer.js';
try {
  Object.assign(shop, await api('/settings'));
  initContact();
} catch {
  document.getElementById('contactStatus').textContent =
    'Chưa tải được thông tin liên hệ. Bạn thử tải lại trang nhé.';
}
try {
  const { customer } = await loadCustomerSession();
  if (customer) {
    const link = document.getElementById('customerLink');
    link.textContent = 'Góc của tôi';
    link.href = '/account/';
  }
} catch {
  /* Vẫn cho phép khách xem thông tin liên hệ khi chưa xác minh được phiên. */
}
