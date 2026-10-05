export const $ = (id) => document.getElementById(id);
export const formatMoney = (amount) => amount.toLocaleString('vi-VN') + ' ₫';
let toastTimer;
export function showToast(s) {
  $('toast').textContent = s;
  $('toast').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').style.display = 'none'), 3000);
}
