const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export const getStoredAuth = () => {
  try {
    return JSON.parse(localStorage.getItem('nexcard_auth') || 'null');
  } catch {
    return null;
  }
};

export const setStoredAuth = (auth) => {
  if (!auth) {
    localStorage.removeItem('nexcard_auth');
    return;
  }
  localStorage.setItem('nexcard_auth', JSON.stringify(auth));
};

async function request(path, options = {}) {
  const auth = getStoredAuth();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (auth?.user?.id) {
    headers['x-user-id'] = auth.user.id;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Error de red');
  }

  return response.json();
}

export const api = {
  health: () => request('/health'),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getLandingContent: () => request('/content/landing'),
  getPublicProfile: (slug) => request(`/public/profiles/${slug}`),
  getMyProfile: () => request('/me/profile'),
  updateMyProfile: (payload) => request('/me/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  getAdminDashboard: () => request('/admin/dashboard'),
  getInventory: () => request('/admin/inventory'),
  getOrders: () => request('/admin/orders'),
  getLandingAdminContent: () => request('/admin/content/landing'),
  updateLandingAdminContent: (payload) => request('/admin/content/landing', { method: 'PUT', body: JSON.stringify(payload) }),
  uploadAvatar: (imageUrl) => request('/upload/avatar', { method: 'POST', body: JSON.stringify({ imageUrl }) }),
  trackClick: (payload) => request('/track', { method: 'POST', body: JSON.stringify(payload) }),
};
