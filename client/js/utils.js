/* BookEase — utils.js | Global utilities */

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : 'https://bookease-z9ao.onrender.com/api';
window.API_BASE = API_BASE;

/* ── Google OAuth Token Handler ── */
(function handleGoogleCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const role = params.get('role');
  const userStr = params.get('user');
  if (token && role) {
    // Save using the app's canonical keys (be_token / be_user)
    localStorage.setItem('be_token', token);
    localStorage.setItem('userRole', role);
    if (userStr) {
      try { localStorage.setItem('be_user', decodeURIComponent(userStr)); } catch(e) {}
    }
    // Also save legacy keys for compatibility
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      if (role === 'host') window.location.href = '/host-dashboard.html';
      else if (role === 'admin') window.location.href = '/admin-dashboard.html';
      else window.location.href = '/client-dashboard.html';
    }, 100);
  }
})();

/* ---- Toast System ---- */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, duration);
}
window.showToast = showToast;

/* ---- Theme ---- */
function initTheme() {
  const saved = localStorage.getItem('be_theme') || 'dark';
  const html = document.documentElement;
  html.setAttribute('data-theme', saved);
  document.body.setAttribute('data-theme', saved);
  html.className = saved === 'dark' ? 'dark-theme' : 'light-theme';
  const icons = document.querySelectorAll('#themeIcon, .theme-icon');
  icons.forEach(function(icon) { icon.textContent = saved === 'dark' ? '🌙' : '☀️'; });
  const btn = document.getElementById('themeToggle');
  if (btn && !btn.hasAttribute('onclick')) {
    btn.addEventListener('click', function() {
      if (typeof toggleTheme === 'function') { toggleTheme(); return; }
      const cur = html.getAttribute('data-theme') || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      document.body.setAttribute('data-theme', next);
      html.className = next === 'dark' ? 'dark-theme' : 'light-theme';
      document.body.style.display = 'none';
      document.body.offsetHeight;
      document.body.style.display = '';
      localStorage.setItem('be_theme', next);
      const ic = document.querySelectorAll('#themeIcon, .theme-icon');
      ic.forEach(function(i) { i.textContent = next === 'dark' ? '🌙' : '☀️'; });
    });
  }
}
window.initTheme = initTheme;
document.addEventListener('DOMContentLoaded', initTheme);

/* ---- Modals ---- */
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
window.openModal = openModal;
window.closeModal = closeModal;

/* ---- JWT decode ---- */
function decodeToken(token) {
  try {
    const p = token.split('.')[1];
    return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
  } catch { return null; }
}
window.decodeToken = decodeToken;

/* ---- Auth helpers ---- */
function getToken() { 
  return localStorage.getItem('be_token') || localStorage.getItem('token'); 
}
function getUser() {
  // Try be_user first (normal login)
  const raw = localStorage.getItem('be_user');
  if (raw) { try { return JSON.parse(raw); } catch { } }
  // Fallback: decode JWT from token (Google OAuth login)
  const token = getToken();
  if (token) {
    const decoded = decodeToken(token);
    if (decoded) {
      const role = localStorage.getItem('userRole') || localStorage.getItem('role') || decoded.role || 'client';
      return {
        _id: decoded.userId,
        id: decoded.userId,
        fullName: decoded.fullName || decoded.name || 'User',
        email: decoded.email || '',
        role: role,
        phone: decoded.phone || '',
        profileImage: decoded.profileImage || ''
      };
    }
  }
  return null;
}
function logout() {
  localStorage.removeItem('be_token');
  localStorage.removeItem('be_user');
  window.location.href = 'login.html';
}
function handleSignOut() {
  localStorage.removeItem('be_token');
  localStorage.removeItem('be_user');
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  localStorage.removeItem('user');
  sessionStorage.clear();
  window.location.href = '../login.html';
}
window.getToken = getToken;
window.getUser = getUser;
window.logout = logout;
window.handleSignOut = handleSignOut;

/* ---- Date helpers ---- */
function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function formatTime(str) {
  if (!str) return '—';
  const [h, m] = str.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
window.formatDate = formatDate;
window.formatTime = formatTime;
window.todayStr = todayStr;

/* ---- Currency ---- */
function formatCurrency(amount) { return '₹' + Number(amount || 0).toLocaleString('en-IN'); }
window.formatCurrency = formatCurrency;

/* ---- Skeleton helpers ---- */
function skeletonCards(count = 6, height = '180px') {
  return Array(count).fill(0).map(() => `<div class="skeleton" style="height:${height};border-radius:var(--radius-lg)"></div>`).join('');
}
window.skeletonCards = skeletonCards;

/* ---- Ripple on buttons ---- */
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
});

/* ---- Scroll-trigger animations ---- */
document.addEventListener('DOMContentLoaded', () => {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('anim-in'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.anim-init').forEach(el => obs.observe(el));
});

/* ---- WhatsApp link builder ---- */
function buildWaLink(phone, message) {
  const clean = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
window.buildWaLink = buildWaLink;

/* ---- ICS Calendar generator ---- */
function generateICS(data) {
  const { title, date, time, duration = 60, description = '' } = data;
  const start = new Date(`${date}T${time}`);
  const end = new Date(start.getTime() + duration * 60000);
  const fmt = d => d.toISOString().replace(/[-:]/g,'').replace('.000','');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BookEase//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'booking.ics';
  a.click();
}
window.generateICS = generateICS;

/* ---- Dashboard sidebar helpers ---- */
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;

/* ---- Password toggle ---- */
function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}
window.togglePwd = togglePwd;

/* ---- Animate number counter ---- */
function animateNum(el, target, prefix = '', suffix = '') {
  let current = 0;
  const inc = target / 40;
  const timer = setInterval(() => {
    current = Math.min(current + inc, target);
    el.textContent = prefix + Math.floor(current).toLocaleString('en-IN') + suffix;
    if (current >= target) clearInterval(timer);
  }, 30);
}
window.animateNum = animateNum;

/* ---- Generate Avatar ---- */
function generateAvatar(name, size = 120) {
  const colors = ['#FF6B35', '#F7931E', '#FFD23F', '#06D6A0', '#118AB2', '#EF476F'];
  const cleanName = (name || 'User').trim().toUpperCase();
  const words = cleanName.split(' ');
  let initials = words[0][0];
  if (words.length > 1) {
    initials += words[words.length - 1][0];
  } else if (cleanName.length > 1) {
    initials += cleanName[1];
  }
  
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size / 2.5}px 'Inter', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2 + (size * 0.05));

  return canvas.toDataURL();
}
window.generateAvatar = generateAvatar;
