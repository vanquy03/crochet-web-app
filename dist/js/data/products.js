import { api } from '../services/api.js';
export const products = [];
export async function loadProducts() {
  const result = await api('/products');
  products.splice(0, products.length, ...result);
}
export function setProducts(items) {
  products.splice(0, products.length, ...items);
}
