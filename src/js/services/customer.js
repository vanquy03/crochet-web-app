import { api } from './api.js';
export let customer = null;
export let customerCsrf = null;
export async function loadCustomerSession() {
  const session = await api('/customer/session');
  customer = session.customer;
  customerCsrf = session.csrfToken;
  return session;
}
export function loginRequired(next = '/account/') {
  if (customer) return false;
  globalThis.location.assign('/login/?next=' + encodeURIComponent(next));
  return true;
}
export function rememberCartAction(productId, quantity, checkout = false) {
  try {
    sessionStorage.setItem(
      'tiemlen-cart-intent',
      JSON.stringify({ productId, quantity, checkout }),
    );
  } catch {
    /* Đăng nhập vẫn hoạt động nếu storage bị chặn. */
  }
  loginRequired('/?cart=1');
}
export function clearCustomer() {
  customer = null;
  customerCsrf = null;
}
export function safeNext(value) {
  try {
    const url = new URL(value || '/account/', globalThis.location.origin);
    if (
      url.origin === globalThis.location.origin &&
      ['/', '/index.html', '/account/', '/contact/', '/community/', '/story/', '/write/'].includes(
        url.pathname,
      )
    )
      return url.pathname + url.search + url.hash;
  } catch {
    /* Dùng trang tài khoản khi URL không hợp lệ. */
  }
  return '/account/';
}
