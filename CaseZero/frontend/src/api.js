export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API;
  const raw = (envUrl || 'http://localhost:5000').trim().replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

const API_BASE = getApiBaseUrl();

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('cz_token');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${cleanPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export { API_BASE };
