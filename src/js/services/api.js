export async function api(path, options = {}) {
  const response = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Không kết nối được dịch vụ cửa hàng.');
  }
  if (!response.ok) {
    const error = new Error(data.error || 'Yêu cầu chưa thành công.');
    error.status = response.status;
    throw error;
  }
  return data;
}
