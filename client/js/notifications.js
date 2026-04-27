/* BookEase — notifications.js */

const NOTIF_KEY = 'be_notifs';

function getNotifs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}

function addNotif(icon, title, body) {
  const notifs = getNotifs();
  notifs.unshift({ id: Date.now(), icon, title, body, time: new Date().toISOString(), read: false });
  localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs.slice(0, 50)));
  updateBadge();
}
window.addNotif = addNotif;

function updateBadge() {
  const unread = getNotifs().filter(n => !n.read).length;
  const badge = document.getElementById('notifBadge');
  const dot = document.querySelector('.notif-dot');
  if (badge) badge.textContent = unread || '';
  if (dot) dot.style.display = unread ? 'block' : 'none';
}

function markAllRead() {
  const notifs = getNotifs().map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
  updateBadge();
}
window.markAllRead = markAllRead;

// Socket.io real-time (connects to backend)
function initSocket(hostId) {
  const script = document.createElement('script');
  script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
  script.onload = () => {
    try {
      const socket = io(window.API_BASE?.replace('/api','') || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://bookease-z9ao.onrender.com'));
      socket.on('connect', () => {
        if (hostId) socket.emit('join-host-room', hostId);
      });
      socket.on('new-booking', (booking) => {
        addNotif('📅', 'New Booking!', `A new booking has been made — #${booking.bookingId}`);
        showToast('🔔 New booking received!', 'success');
        if (typeof loadInbox === 'function') loadInbox();
      });
      socket.on('booking-updated', (booking) => {
        addNotif('🔄', 'Booking Updated', `Booking #${booking.bookingId} is now ${booking.status}`);
      });
    } catch(e) { console.warn('Socket.io not available:', e.message); }
  };
  document.head.appendChild(script);
}
window.initSocket = initSocket;

document.addEventListener('DOMContentLoaded', updateBadge);
