import { api } from '../services/api.js';
import { loadCustomerSession, safeNext } from '../services/customer.js';
const form = document.getElementById('authForm');
const status = document.getElementById('authStatus');
const next = safeNext(new URLSearchParams(location.search).get('next'));
const register = form.dataset.mode === 'register';
document.getElementById('switchAuth').href =
  (register ? '/login/' : '/register/') + '?next=' + encodeURIComponent(next);
try {
  const session = await loadCustomerSession();
  if (session.customer) location.replace(next);
} catch {
  status.textContent = 'Không kết nối được cửa hàng. Vui lòng thử lại.';
}
const confirmation = form.elements.namedItem('confirmation');
if (confirmation) {
  const validate = () =>
    confirmation.setCustomValidity(
      confirmation.value === form.elements.password.value ? '' : 'Mật khẩu xác nhận chưa khớp.',
    );
  confirmation.oninput = validate;
  form.elements.password.oninput = validate;
}
form.onsubmit = async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = register ? 'Đang tạo tài khoản…' : 'Đang đăng nhập…';
  try {
    const fields = Object.fromEntries(new FormData(form));
    await api('/customer/' + (register ? 'register' : 'login'), {
      method: 'POST',
      body: JSON.stringify({ name: fields.name, email: fields.email, password: fields.password }),
    });
    location.replace(next);
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
};
