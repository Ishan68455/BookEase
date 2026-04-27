/* BookEase — client-dashboard.js */

let allBookings = [], allHosts = [], currentFilter = 'all';

async function init() {
  const token = localStorage.getItem('be_token') || localStorage.getItem('token');
  if (!token) { window.location.href = 'login.html'; return; }
  const user = getUser();
  const role = user?.role || localStorage.getItem('userRole') || localStorage.getItem('role');
  if (!user || role !== 'client') { window.location.href = 'login.html'; return; }
  document.getElementById('sidebarName').textContent = user.fullName;
  document.getElementById('greetingName').textContent = getGreeting() + ', ' + user.fullName.split(' ')[0] + '! 👋';
  const av = user.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`;
  document.getElementById('sidebarAvatar').src = av;
  document.getElementById('topAvatar').src = av;
  document.getElementById('profileImg').src = av;
  document.getElementById('profileName').textContent = user.fullName;
  document.getElementById('profileEmail').textContent = user.email;
  document.getElementById('pName').value = user.fullName;
  document.getElementById('pEmail').value = user.email;
  document.getElementById('pPhone').value = user.phone || '';
  const backBtn = document.getElementById('mobileBackBtn');
  if (backBtn && window.innerWidth <= 768) {
    backBtn.style.display = 'none';
  }
  await loadOverview();
  showSection('overview');
}

function handleMobileBack() {
  const activeSection = document.querySelector('.dash-section:not(.hidden)');
  const currentSection = activeSection ? activeSection.id.replace('sec', '').toLowerCase() : '';
  const sectionParent = {
    'browse': 'overview',
    'bookings': 'overview', 
    'profile': 'overview',
    'favorites': 'overview',
    'notifs': 'overview'
  };
  const parent = sectionParent[currentSection];
  if (parent) {
    showSection(parent);
    if (parent === 'overview') {
      const backBtn = document.getElementById('mobileBackBtn');
      if (backBtn) backBtn.style.display = 'none';
    }
  } else {
    window.location.href = 'index.html';
  }
}
window.handleMobileBack = handleMobileBack;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

async function loadOverview() {
  try {
    const d = await API.bookings.my();
    allBookings = d.bookings || [];
    const upcoming = allBookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
    const completed = allBookings.filter(b => b.status === 'completed');
    const cancelled = allBookings.filter(b => b.status === 'cancelled');
    document.getElementById('upcomingCount').textContent = upcoming.length;
    animateNum(document.getElementById('statTotal'), allBookings.length);
    animateNum(document.getElementById('statCompleted'), completed.length);
    animateNum(document.getElementById('statUpcoming'), upcoming.length);
    animateNum(document.getElementById('statCancelled'), cancelled.length);
    renderBookingCards(allBookings.slice(0, 3), 'recentBookings');
  } catch(e) { showToast('Failed to load data: ' + e.message, 'error'); }
}

function renderBookingCards(bookings, containerId) {
  const container = document.getElementById(containerId);
  if (!bookings.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No bookings yet</h3><p>Browse services and book your first appointment!</p><a href="#" onclick="showSection('browse')" class="btn btn-primary">Browse Services →</a></div>`;
    return;
  }
  container.innerHTML = bookings.map(b => `
    <div class="booking-card" style="margin-bottom:12px">
      <img class="booking-thumb" src="${b.hostId?.coverImage || 'https://placehold.co/56x56/1A1A2E/FFCA28?text=B'}" alt="" loading="lazy">
      <div class="booking-info">
        <div class="booking-title">${b.serviceId?.name || '—'}</div>
        <div class="booking-meta">
          <span>🏪 ${b.hostId?.businessName || '—'}</span>
          <span>📅 ${b.bookingDate}</span>
          <span>⏰ ${formatTime(b.bookingTime)}</span>
          <span>💰 ${formatCurrency(b.amount)}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="chip chip-${b.status}">${b.status}</span>
          <span class="chip chip-${b.paymentMode}">${b.paymentMode === 'cod' ? 'Pay at Shop' : 'Online'}</span>
          ${b.paymentStatus === 'paid' ? '<span class="chip chip-paid">Paid</span>' : ''}
        </div>
        <div class="booking-actions" style="margin-top:10px">
          ${b.status === 'completed' ? `<button class="btn btn-sm btn-primary" onclick="openReview('${b._id}')">⭐ Review</button>` : ''}
          ${(b.status === 'confirmed' || b.status === 'pending') ? `<button class="btn btn-sm btn-danger" onclick="cancelBooking('${b._id}')">Cancel</button>` : ''}
          <button class="btn btn-sm btn-dark" onclick="reBook('${b.hostId?._id}')">Re-book</button>
        </div>
      </div>
    </div>`).join('');
}

async function filterBookings(status, btn) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = status;
  const filtered = status === 'all' ? allBookings : allBookings.filter(b => {
    if (status === 'confirmed') return b.status === 'confirmed' || b.status === 'pending';
    return b.status === status;
  });
  renderBookingCards(filtered, 'bookingsList');
}
window.filterBookings = filterBookings;

async function cancelBooking(id) {
  if (!confirm('Cancel this booking?')) return;
  try {
    await API.bookings.cancel(id, 'Cancelled by client');
    showToast('Booking cancelled', 'info');
    await loadOverview();
    renderBookingCards(allBookings, 'bookingsList');
  } catch(e) { showToast(e.message, 'error'); }
}
window.cancelBooking = cancelBooking;

function reBook(hostId) { window.location.href = 'booking-flow.html?hostId=' + hostId; }
window.reBook = reBook;

async function loadHosts() {
  document.getElementById('hostsGrid').innerHTML = skeletonCards(6, '280px');
  try {
    const d = await API.hosts.list();
    allHosts = d.hosts || [];
    renderHostCards(allHosts, 'hostsGrid');
  } catch(e) { showToast('Failed to load hosts: ' + e.message, 'error'); }
}

function renderHostCards(hosts, containerId) {
  const container = document.getElementById(containerId);
  const user = getUser();
  if (!hosts.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No results found</h3><p>Try a different search or category</p></div>`;
    return;
  }
  container.innerHTML = hosts.map(h => `
    <div class="card host-card hover-lift">
      ${h.badge ? `<div class="host-badge">${h.badge}</div>` : ''}
      <button class="fav-btn ${(user?.favorites||[]).includes(h._id) ? 'active' : ''}" onclick="toggleFav(event,'${h._id}')">❤</button>
      <img class="host-card-cover" src="${h.coverImage || 'https://placehold.co/400x190/1A1A2E/FFCA28?text='+encodeURIComponent(h.businessName)}" alt="${h.businessName}" loading="lazy">
      <div class="host-card-body">
        <img class="host-avatar" src="${h.profileImage || 'https://api.dicebear.com/7.x/initials/svg?seed='+encodeURIComponent(h.businessName)}" alt="">
        <div class="host-name">${h.businessName}</div>
        <div class="host-type">${h.businessType} ${h.location?.city ? '· 📍 '+h.location.city : ''}</div>
        <div class="host-rating"><span class="stars">${'★'.repeat(Math.round(h.rating||0))}${'☆'.repeat(5-Math.round(h.rating||0))}</span><span>${h.rating||0}</span><span style="color:var(--text-muted);font-size:0.8rem">(${h.totalReviews||0})</span></div>
        <div class="host-price">From <strong>₹${h.minPrice||0}</strong></div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <a href="host-profile.html?slug=${h.businessSlug}" class="btn btn-outline btn-sm" style="flex:1;text-align:center">View</a>
          <a href="booking-flow.html?hostId=${h._id}" class="btn btn-primary btn-sm" style="flex:1;text-align:center">Book Now</a>
        </div>
      </div>
    </div>`).join('');
}

async function filterHosts() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('filterCategory').value;
  const rating = parseFloat(document.getElementById('filterRating').value) || 0;
  const filtered = allHosts.filter(h =>
    (!q || h.businessName?.toLowerCase().includes(q) || h.businessType?.toLowerCase().includes(q) || h.description?.toLowerCase().includes(q)) &&
    (!cat || h.businessType === cat) &&
    (!rating || (h.rating || 0) >= rating)
  );
  renderHostCards(filtered, 'hostsGrid');
}
window.filterHosts = filterHosts;

async function toggleFav(e, hostId) {
  e.stopPropagation(); e.preventDefault();
  try {
    const d = await API.hosts.toggleFavorite(hostId);
    const user = getUser();
    user.favorites = d.favorites;
    localStorage.setItem('be_user', JSON.stringify(user));
    e.target.classList.toggle('active');
    showToast(e.target.classList.contains('active') ? '❤ Added to favorites' : 'Removed from favorites', 'info');
  } catch(err) { showToast(err.message, 'error'); }
}
window.toggleFav = toggleFav;

async function loadFavorites() {
  document.getElementById('favoritesGrid').innerHTML = skeletonCards(4, '280px');
  try {
    const d = await API.hosts.favorites();
    renderHostCards(d.favorites || [], 'favoritesGrid');
  } catch(e) { showToast(e.message, 'error'); }
}

function openReview(bookingId) {
  document.getElementById('reviewBookingId').value = bookingId;
  document.getElementById('reviewRating').value = 0;
  document.querySelectorAll('#reviewStars .star').forEach(s => s.classList.remove('filled'));
  document.getElementById('reviewComment').value = '';
  openModal('reviewModal');
}
window.openReview = openReview;

document.querySelectorAll('#reviewStars .star').forEach(star => {
  star.addEventListener('click', () => {
    const v = parseInt(star.dataset.v);
    document.getElementById('reviewRating').value = v;
    document.querySelectorAll('#reviewStars .star').forEach((s, i) => s.classList.toggle('filled', i < v));
  });
});

async function submitReview() {
  const rating = parseInt(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value.trim();
  const bookingId = document.getElementById('reviewBookingId').value;
  if (!rating) return showToast('Please select a star rating', 'error');
  try {
    await API.bookings.review(bookingId, { rating, comment });
    showToast('Review submitted! Thank you ⭐', 'success');
    closeModal('reviewModal');
  } catch(e) { showToast(e.message, 'error'); }
}
window.submitReview = submitReview;

document.getElementById('profileForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  showToast('Profile update requires backend endpoint', 'info');
});

function showSection(id) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const sec = document.getElementById('sec' + id.charAt(0).toUpperCase() + id.slice(1));
  if (sec) sec.classList.remove('hidden');
  const titles = { overview: 'Overview', bookings: 'My Bookings', browse: 'Browse Services', favorites: 'My Favorites', profile: 'Profile Settings', notifs: 'Notifications' };
  document.getElementById('topbarTitle').textContent = titles[id] || id;
  const navId = 'nav' + id.charAt(0).toUpperCase() + id.slice(1);
  document.getElementById(navId)?.classList.add('active');
  if (id === 'bookings') renderBookingCards(allBookings, 'bookingsList');
  if (id === 'browse') loadHosts();
  if (id === 'favorites') loadFavorites();
  if (id === 'notifs') renderNotifications();

  // Show back button on mobile when not on overview
  const backBtn = document.getElementById('mobileBackBtn');
  if (backBtn) {
    if (id === 'overview' || id === 'home') {
      backBtn.style.display = 'none';
    } else {
      if (window.innerWidth <= 768) {
        backBtn.style.display = 'flex';
      }
    }
  }

  // Sync bottom nav active state
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeNavItem = document.querySelector(`.bottom-nav-item[onclick*="('${id}')"]`);
  if (activeNavItem) activeNavItem.classList.add('active');
}
window.showSection = showSection;

function renderNotifications() {
  const notifs = JSON.parse(localStorage.getItem('be_notifs') || '[]');
  const container = document.getElementById('notifList');
  if (!notifs.length) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔔</div><h3>No notifications</h3><p>You're all caught up!</p></div>`; return; }
  container.innerHTML = notifs.map(n => `<div style="display:flex;gap:14px;padding:16px;background:#fff;border-radius:var(--radius-lg);border:1px solid var(--border);margin-bottom:10px">
    <div style="font-size:1.5rem">${n.icon||'🔔'}</div>
    <div><div style="font-weight:600">${n.title}</div><div style="color:var(--text-muted);font-size:0.85rem">${n.body}</div><div style="color:var(--text-muted);font-size:0.75rem;margin-top:4px">${new Date(n.time).toLocaleString()}</div></div>
  </div>`).join('');
}

init();
