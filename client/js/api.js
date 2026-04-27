/* BookEase — api.js | Fetch wrapper */

const BASE = window.API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : 'https://bookease-z9ao.onrender.com/api');

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('be_token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
  try {
    const res = await fetch(BASE + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
    return data;
  } catch (err) {
    throw new Error('Network Error: ' + err.message);
  }
}

async function apiUpload(path, formData) {
  const token = localStorage.getItem('be_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch((window.API_BASE || BASE) + path, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data;
}

// Auth
const API = {
  auth: {
    register: d => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
    login: d => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(d) }),
    loginWithOtp: d => apiFetch('/auth/login-with-otp', { method: 'POST', body: JSON.stringify(d) }),
    sendPhoneOtp: d => apiFetch('/auth/send-phone-otp', { method: 'POST', body: JSON.stringify(d) }),
    verifyPhoneOtp: d => apiFetch('/auth/verify-phone-otp', { method: 'POST', body: JSON.stringify(d) }),
    sendEmailOtp: d => apiFetch('/auth/send-email-otp', { method: 'POST', body: JSON.stringify(d) }),
    verifyEmailOtp: d => apiFetch('/auth/verify-email-otp', { method: 'POST', body: JSON.stringify(d) }),
    forgotPassword: d => apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify(d) }), // Keeping for fallback if needed
    resetPassword: d => apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify(d) }),
    me: () => apiFetch('/auth/me'),
  },
  hosts: {
    list: (q = '') => apiFetch('/hosts?' + q),
    my: () => apiFetch('/hosts/my'),
    bySlug: slug => apiFetch('/hosts/slug/' + slug),
    byId: id => apiFetch('/hosts/' + id),
    update: d => apiFetch('/hosts/my', { method: 'PUT', body: JSON.stringify(d) }),
    uploadCover: f => { const fd = new FormData(); fd.append('cover', f); return apiUpload('/hosts/upload-cover', fd); },
    uploadGallery: files => { const fd = new FormData(); [...files].forEach(f => fd.append('gallery', f)); return apiUpload('/hosts/upload-gallery', fd); },
    toggleFavorite: hostId => apiFetch('/hosts/toggle-favorite', { method: 'POST', body: JSON.stringify({ hostId }) }),
    favorites: () => apiFetch('/hosts/favorites/list'),
  },
  services: {
    byHost: hostId => apiFetch('/services/host/' + hostId),
    my: () => apiFetch('/services/my'),
    create: (d, img) => { if (img) { const fd = new FormData(); Object.keys(d).forEach(k => fd.append(k, d[k])); fd.append('image', img); return apiUpload('/services', fd); } return apiFetch('/services', { method: 'POST', body: JSON.stringify(d) }); },
    update: (id, d, img) => { if (img) { const fd = new FormData(); Object.keys(d).forEach(k => fd.append(k, d[k])); fd.append('image', img); return apiUpload('/services/' + id, fd); } return apiFetch('/services/' + id, { method: 'PUT', body: JSON.stringify(d) }); },
    delete: id => apiFetch('/services/' + id, { method: 'DELETE' }),
  },
  slots: {
    available: (hostId, date) => apiFetch(`/slots?hostId=${hostId}&date=${date}`),
    my: (month) => apiFetch('/slots/my' + (month ? '?month=' + month : '')),
    create: slots => apiFetch('/slots', { method: 'POST', body: JSON.stringify({ slots }) }),
    block: id => apiFetch('/slots/' + id + '/block', { method: 'PUT' }),
    delete: id => apiFetch('/slots/' + id, { method: 'DELETE' }),
    bulkWeek: d => apiFetch('/slots/bulk-week', { method: 'POST', body: JSON.stringify(d) }),
  },
  bookings: {
    create: d => apiFetch('/bookings', { method: 'POST', body: JSON.stringify(d) }),
    my: (status = '') => apiFetch('/bookings/my' + (status ? '?status=' + status : '')),
    host: (status = '') => apiFetch('/bookings/host' + (status ? '?status=' + status : '')),
    one: id => apiFetch('/bookings/' + id),
    updateStatus: (id, status, reason) => apiFetch('/bookings/' + id + '/status', { method: 'PUT', body: JSON.stringify({ status, cancellationReason: reason }) }),
    cancel: (id, reason) => apiFetch('/bookings/' + id + '/cancel', { method: 'PUT', body: JSON.stringify({ reason }) }),
    review: (id, d) => apiFetch('/bookings/' + id + '/review', { method: 'POST', body: JSON.stringify(d) }),
    hostStats: () => apiFetch('/bookings/host/stats'),
  },
  payments: {
    confirmCod: bookingId => apiFetch('/payments/confirm-cod', { method: 'POST', body: JSON.stringify({ bookingId }) }),
    confirmOnline: bookingId => apiFetch('/payments/confirm-online', { method: 'POST', body: JSON.stringify({ bookingId }) }),
    markReceived: bookingId => apiFetch('/payments/' + bookingId + '/received', { method: 'PUT' }),
  },
  admin: {
    stats: () => apiFetch('/admin/stats'),
    users: (role, page) => apiFetch(`/admin/users?role=${role}&page=${page}`),
    hosts: () => apiFetch('/admin/hosts'),
    bookings: (page) => apiFetch('/admin/bookings?page=' + page),
    verifyHost: (id, verify) => apiFetch('/admin/hosts/' + id + '/verify', { method: 'PUT', body: JSON.stringify({ verify }) }),
    suspendUser: (id, suspend) => apiFetch('/admin/users/' + id + '/suspend', { method: 'PUT', body: JSON.stringify({ suspend }) }),
  }
};

window.API = API;
window.apiFetch = apiFetch;
window.apiUpload = apiUpload;
