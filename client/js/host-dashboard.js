/* BookEase — host-dashboard.js */
let hostData = null, hostBookings = [], calYear, calMonth, pendingSlots = [], selectedDate = '';

async function init() {
  const user = getUser();
  if (!user || user.role !== 'host') { window.location.href = 'login.html'; return; }
  document.getElementById('sidebarName').textContent = user.fullName;
  const av = user.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`;
  document.getElementById('sidebarAvatar').src = av;
  const backBtn = document.getElementById('mobileBackBtn');
  if (backBtn && window.innerWidth <= 768) {
    backBtn.style.display = 'none';
  }
  await loadHostData();
  await loadStats();
  showSection('overview');
}

function handleMobileBack() {
  const activeSection = document.querySelector('.dash-section:not(.hidden)');
  const currentSection = activeSection ? activeSection.id.replace('sec', '').toLowerCase() : '';
  const sectionParent = {
    'services': 'overview',
    'slots': 'overview', 
    'inbox': 'overview',
    'reviews': 'overview'
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

async function loadHostData() {
  try {
    const d = await API.hosts.my();
    hostData = d.host;
    document.getElementById('shareProfileLink').href = `host-profile.html?slug=${hostData.businessSlug}`;
    populateBusinessForm(hostData);
    renderWorkingHoursForm(hostData.workingHours || []);
    renderGallery(hostData.galleryImages || []);
    renderStaffList(hostData.staff || []);
  } catch(e) { showToast(e.message, 'error'); }
}

function populateBusinessForm(h) {
  ['bizName','bizDesc','bizCity','bizAddress','bizWhatsapp','bizInsta','bizFb'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'bizName') el.value = h.businessName || '';
    else if (id === 'bizDesc') el.value = h.description || '';
    else if (id === 'bizCity') el.value = h.location?.city || '';
    else if (id === 'bizAddress') el.value = h.location?.address || '';
    else if (id === 'bizWhatsapp') el.value = h.whatsappNumber || '';
    else if (id === 'bizInsta') el.value = h.socialLinks?.instagram || '';
    else if (id === 'bizFb') el.value = h.socialLinks?.facebook || '';
  });
  if (h.businessType) document.getElementById('bizType').value = h.businessType;
  if (h.cancellationPolicy) document.getElementById('bizCancel').value = h.cancellationPolicy;
  if (h.coverImage) document.getElementById('coverPreview').src = h.coverImage;
  document.getElementById('bizNameDisplay').textContent = h.businessName || 'Your Business';
  document.getElementById('bizTypeDisplay').textContent = h.businessType || '';
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function renderWorkingHoursForm(wh) {
  const grid = document.getElementById('workingHoursGrid');
  grid.innerHTML = DAYS.map(day => {
    const d = wh.find(x => x.day === day) || { isOpen: false, startTime: '09:00', endTime: '18:00' };
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
      <label class="toggle-switch"><input type="checkbox" ${d.isOpen?'checked':''} onchange="toggleDay('${day}',this)"><span class="toggle-slider"></span></label>
      <span style="width:90px;font-weight:600;font-size:0.9rem">${day.slice(0,3)}</span>
      <input type="time" class="form-control" style="width:110px" id="wh_start_${day}" value="${d.startTime}" ${!d.isOpen?'disabled':''}>
      <span style="color:var(--text-muted)">–</span>
      <input type="time" class="form-control" style="width:110px" id="wh_end_${day}" value="${d.endTime}" ${!d.isOpen?'disabled':''}>
    </div>`;
  }).join('');
}
window.toggleDay = (day, cb) => {
  document.getElementById('wh_start_'+day).disabled = !cb.checked;
  document.getElementById('wh_end_'+day).disabled = !cb.checked;
};

function getWorkingHours() {
  return DAYS.map(day => {
    const isOpen = document.querySelector(`#workingHoursGrid input[type="checkbox"]:nth-of-type(${DAYS.indexOf(day)+1})`)?.checked || false;
    return { day, isOpen, startTime: document.getElementById('wh_start_'+day)?.value||'09:00', endTime: document.getElementById('wh_end_'+day)?.value||'18:00' };
  });
}

document.getElementById('businessForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  // Validate WhatsApp number
  const waNum = document.getElementById('bizWhatsapp').value.replace(/\D/g,'');
  if (waNum && waNum.length !== 10) {
    showToast('Please enter a valid 10-digit WhatsApp number', 'error');
    return;
  }
  const payload = {
    businessName: document.getElementById('bizName').value,
    businessType: document.getElementById('bizType').value,
    description: document.getElementById('bizDesc').value,
    location: { city: document.getElementById('bizCity').value, address: document.getElementById('bizAddress').value },
    whatsappNumber: waNum,
    socialLinks: { instagram: document.getElementById('bizInsta').value, facebook: document.getElementById('bizFb').value },
    cancellationPolicy: document.getElementById('bizCancel').value,
    workingHours: getWorkingHours()
  };
  try {
    await API.hosts.update(payload);
    showToast('Business profile saved!', 'success');
    await loadHostData();
  } catch(e) { showToast(e.message, 'error'); }
});

function previewCover(inp) {
  if (!inp.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => document.getElementById('coverPreview').src = e.target.result;
  reader.readAsDataURL(inp.files[0]);
  API.hosts.uploadCover(inp.files[0]).then(() => showToast('Cover uploaded!','success')).catch(e => showToast(e.message,'error'));
}
window.previewCover = previewCover;

function renderGallery(imgs) {
  document.getElementById('galleryPreview').innerHTML = imgs.map(src =>
    `<img src="${src}" style="width:80px;height:60px;object-fit:cover;border-radius:var(--radius-md)" loading="lazy">`
  ).join('');
}
function uploadGallery(inp) {
  if (!inp.files.length) return;
  API.hosts.uploadGallery(inp.files).then(d => { showToast('Gallery updated!','success'); renderGallery(d.galleryImages||[]); }).catch(e => showToast(e.message,'error'));
}
window.uploadGallery = uploadGallery;

function renderStaffList(staff) {
  document.getElementById('staffList').innerHTML = staff.map((s,i) =>
    `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <input class="form-control" style="flex:1" value="${s.name}" placeholder="Staff name" id="sn_${i}">
      <input class="form-control" style="flex:1" value="${s.role}" placeholder="Role/Specialty" id="sr_${i}">
    </div>`
  ).join('');
}
function addStaffRow() {
  const sl = document.getElementById('staffList');
  const i = sl.children.length;
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)';
  div.innerHTML = `<input class="form-control" style="flex:1" placeholder="Staff name" id="sn_${i}"><input class="form-control" style="flex:1" placeholder="Role" id="sr_${i}">`;
  sl.appendChild(div);
}
window.addStaffRow = addStaffRow;

async function loadStats() {
  try {
    const d = await API.bookings.hostStats();
    animateNum(document.getElementById('hStatTotal'), d.totalBookings||0);
    animateNum(document.getElementById('hStatRevenue'), d.monthRevenue||0, '₹');
    animateNum(document.getElementById('hStatToday'), d.todayBookings||0);
    document.getElementById('hStatRating').textContent = (d.avgRating||0) + ' ⭐';
    animateNum(document.getElementById('earnTotal'), d.revenue||0, '₹');
    animateNum(document.getElementById('earnMonth'), d.monthRevenue||0, '₹');
    if (d.chartData) renderCharts(d.chartData);
    loadInbox();
  } catch(e) { console.error(e); }
}

function renderCharts(data) {
  const labels = data.map(d => d.month);
  const values = data.map(d => d.bookings);
  const cfg = { type:'bar', data:{ labels, datasets:[{ label:'Bookings', data:values, backgroundColor:'rgba(255,202,40,0.6)', borderColor:'#FFCA28', borderWidth:2, borderRadius:6 }] }, options:{ plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false}}, y:{grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#9CA3AF'}} } } };
  const bCtx = document.getElementById('bookingsChart');
  const eCtx = document.getElementById('earningsChart');
  if (bCtx) new Chart(bCtx, cfg);
  if (eCtx) new Chart(eCtx, { ...cfg, type:'bar', data:{ labels, datasets:[{ ...cfg.data.datasets[0], label:'Revenue (₹)', data: values.map(v=>v*500), backgroundColor:'rgba(0,200,150,0.5)', borderColor:'#00C896' }] } });
}

// Services
async function loadServices() {
  document.getElementById('servicesGrid').innerHTML = skeletonCards(4,'200px');
  try {
    const d = await API.services.my();
    renderServices(d.services||[]);
  } catch(e) { showToast(e.message,'error'); }
}

function renderServices(services) {
  if (!services.length) {
    document.getElementById('servicesGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">💆</div><h3>No services yet</h3><p>Add your first service to start accepting bookings.</p><button class="btn btn-primary" onclick="openServiceModal()">+ Add Service</button></div>`;
    return;
  }
  document.getElementById('servicesGrid').innerHTML = services.map(s => `
    <div class="service-card">
      <img class="service-img" src="${s.image||'https://placehold.co/400x140/1A1A2E/FFCA28?text='+encodeURIComponent(s.name)}" alt="${s.name}" loading="lazy">
      <div class="service-body">
        <div class="service-name">${s.name}</div>
        <div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:6px">${s.description||''}</div>
        <div style="display:flex;gap:12px;align-items:center"><span class="service-price">₹${s.price}</span><span class="service-duration">⏱ ${s.duration} mins</span></div>
      </div>
      <div class="service-footer">
        <label class="toggle-switch"><input type="checkbox" ${s.isActive?'checked':''} onchange="toggleService('${s._id}',this)"><span class="toggle-slider"></span></label>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-dark" onclick="editService(${JSON.stringify(s).replace(/"/g,'&quot;')})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteService('${s._id}')">Delete</button>
        </div>
      </div>
    </div>`).join('');
}

let serviceImg = null;
function openServiceModal(s=null) {
  document.getElementById('serviceModalTitle').textContent = s ? 'Edit Service' : 'Add Service';
  document.getElementById('serviceEditId').value = s?._id || '';
  document.getElementById('sName').value = s?.name || '';
  document.getElementById('sDesc').value = s?.description || '';
  document.getElementById('sPrice').value = s?.price || '';
  document.getElementById('sDuration').value = s?.duration || '';
  if (s?.category) document.getElementById('sCategory').value = s.category;
  document.getElementById('serviceImgPreview').src = s?.image || '';
  serviceImg = null;
  openModal('serviceModal');
}
window.openServiceModal = openServiceModal;

function previewServiceImg(inp) { if (!inp.files[0]) return; serviceImg = inp.files[0]; const r = new FileReader(); r.onload = e => document.getElementById('serviceImgPreview').src = e.target.result; r.readAsDataURL(inp.files[0]); }
window.previewServiceImg = previewServiceImg;

function editService(s) { openServiceModal(s); }
window.editService = editService;

document.getElementById('serviceForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const id = document.getElementById('serviceEditId').value;
  const d = { name: document.getElementById('sName').value, description: document.getElementById('sDesc').value, price: document.getElementById('sPrice').value, duration: document.getElementById('sDuration').value, category: document.getElementById('sCategory').value };
  try {
    if (id) await API.services.update(id, d, serviceImg);
    else await API.services.create(d, serviceImg);
    showToast(id ? 'Service updated!' : 'Service added!', 'success');
    closeModal('serviceModal');
    loadServices();
  } catch(er) { showToast(er.message,'error'); }
});

async function deleteService(id) {
  if (!confirm('Delete this service?')) return;
  try { await API.services.delete(id); showToast('Service deleted','info'); loadServices(); } catch(e) { showToast(e.message,'error'); }
}
window.deleteService = deleteService;

async function toggleService(id, cb) {
  try { await API.services.update(id, { isActive: cb.checked }); } catch(e) { showToast(e.message,'error'); cb.checked = !cb.checked; }
}
window.toggleService = toggleService;

// Slot calendar
const now = new Date();
calYear = now.getFullYear(); calMonth = now.getMonth();
function renderCalendar() {
  const first = new Date(calYear, calMonth, 1);
  const last = new Date(calYear, calMonth+1, 0);
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = `${monthNames[calMonth]} ${calYear}`;
  const grid = document.getElementById('calGrid');
  const labels = '<div class="calendar-day-label">Su</div><div class="calendar-day-label">Mo</div><div class="calendar-day-label">Tu</div><div class="calendar-day-label">We</div><div class="calendar-day-label">Th</div><div class="calendar-day-label">Fr</div><div class="calendar-day-label">Sa</div>';
  let cells = labels;
  for (let i=0; i<first.getDay(); i++) cells += '<div class="calendar-day empty"></div>';
  const todayD = new Date();
  for (let d=1; d<=last.getDate(); d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = d===todayD.getDate() && calMonth===todayD.getMonth() && calYear===todayD.getFullYear();
    const isPast = new Date(dateStr) < new Date(todayD.toDateString());
    cells += `<div class="calendar-day ${isToday?'today':''} ${isPast?'past':''} ${selectedDate===dateStr?'selected':''}" onclick="${isPast?'':`selectDate('${dateStr}')`}">${d}</div>`;
  }
  grid.innerHTML = cells;
}
window.renderCalendar = renderCalendar;
window.changeMonth = (dir) => { calMonth += dir; if (calMonth > 11) { calMonth=0; calYear++; } if (calMonth < 0) { calMonth=11; calYear--; } renderCalendar(); };

function selectDate(dateStr) {
  selectedDate = dateStr;
  document.getElementById('selectedDateLabel').textContent = dateStr;
  document.getElementById('selectedDateLabel2').textContent = dateStr;
  renderCalendar();
  loadManagedSlots(dateStr);
}
window.selectDate = selectDate;

function addSlotTime() {
  const s = document.getElementById('slotStart').value, e = document.getElementById('slotEnd').value;
  if (!s || !e) return showToast('Enter start and end time','error');
  pendingSlots.push({ startTime:s, endTime:e });
  renderPendingSlots();
}
window.addSlotTime = addSlotTime;

function renderPendingSlots() {
  document.getElementById('pendingSlotsList').innerHTML = pendingSlots.map((sl,i) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="chip chip-confirmed">${sl.startTime} – ${sl.endTime}</span><button onclick="removePendingSlot(${i})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:1rem">✕</button></div>`
  ).join('');
}
window.removePendingSlot = (i) => { pendingSlots.splice(i,1); renderPendingSlots(); };

async function saveSlots() {
  if (!selectedDate) return showToast('Select a date first','error');
  if (!pendingSlots.length) return showToast('Add at least one time slot','error');
  const slots = pendingSlots.map(sl => ({ date: selectedDate, startTime: sl.startTime, endTime: sl.endTime }));
  try { 
    const d = await API.slots.create(slots); 
    if (d.slots?.length > 0) {
      showToast(`${d.slots.length} slots saved!`,'success'); 
    } else {
      showToast('No slots saved. They might already exist!', 'error');
    }
    pendingSlots=[]; 
    renderPendingSlots(); 
    loadManagedSlots(selectedDate); 
  } catch(e) { 
    showToast(e.message,'error'); 
  }
}
window.saveSlots = saveSlots;

async function loadManagedSlots(date) {
  if (!hostData) return;
  const d = await API.slots.available(hostData._id, date);
  document.getElementById('managedSlots').innerHTML = (d.slots||[]).map(sl =>
    `<div class="slot-pill ${sl.isBooked?'booked':''}" style="display:flex;align-items:center;gap:6px">${sl.startTime} – ${sl.endTime} ${sl.isBooked?'🔴':'🟢'}${!sl.isBooked?`<button onclick="deleteSlot('${sl._id}')" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:0.9rem">✕</button>`:''}</div>`
  ).join('') || '<p class="text-muted">No slots for this date</p>';
}
async function deleteSlot(id) { try { await API.slots.delete(id); showToast('Slot removed','info'); loadManagedSlots(selectedDate); } catch(e) { showToast(e.message,'error'); } }
window.deleteSlot = deleteSlot;

async function bulkCreateSlots() {
  const startDate = document.getElementById('bulkStart').value;
  const weeks = parseInt(document.getElementById('bulkWeeks').value)||4;
  const from = document.getElementById('bulkFrom').value;
  const to = document.getElementById('bulkTo').value;
  if (!startDate) return showToast('Select a start date','error');
  const dailySlots = [1,2,3,4,5].map(day => ({ day, startTime: from, endTime: to }));
  try { 
    const d = await API.slots.bulkWeek({ startDate, weeks, dailySlots }); 
    if (d.count > 0) {
      showToast(`${d.count} slots created!`,'success'); 
    } else {
      showToast('No slots created. They might already exist!', 'error');
    }
  } catch(e) { showToast(e.message,'error'); }
}
window.bulkCreateSlots = bulkCreateSlots;

// Bookings Inbox
async function loadInbox() {
  if (!hostData) return;
  const d = await API.bookings.host();
  hostBookings = d.bookings||[];
  const pending = hostBookings.filter(b=>b.status==='pending').length;
  document.getElementById('inboxBadge').textContent = pending;
  document.getElementById('hostNotifDot').style.display = pending ? 'block' : 'none';
  renderInbox(hostBookings, 'recentInbox');
}

function renderInbox(bookings, containerId='inboxList') {
  const container = document.getElementById(containerId);
  if (!bookings.length) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📥</div><h3>No bookings yet</h3><p>Bookings will appear here once clients start booking.</p></div>`; return; }
  container.innerHTML = bookings.slice(0, containerId==='recentInbox'?5:999).map(b => `
    <div class="booking-card" style="margin-bottom:12px">
      <img class="booking-thumb" src="${b.clientId?.profileImage||'https://api.dicebear.com/7.x/initials/svg?seed='+encodeURIComponent(b.clientId?.fullName||'U')}" alt="" loading="lazy">
      <div class="booking-info">
        <div class="booking-title">${b.clientId?.fullName||'—'} — ${b.serviceId?.name||'—'}</div>
        <div class="booking-meta"><span>📅 ${b.bookingDate}</span><span>⏰ ${formatTime(b.bookingTime)}</span><span>📱 ${b.clientId?.phone||'—'}</span><span>💰 ₹${b.amount}</span></div>
        <div style="display:flex;gap:8px;margin-top:6px;align-items:center"><span class="chip chip-${b.status}">${b.status}</span><span class="chip chip-${b.paymentMode}">${b.paymentMode}</span></div>
        <div class="booking-actions" style="margin-top:8px">
          ${b.status==='pending'?`<button class="btn btn-success btn-sm" onclick="updateStatus('${b._id}','confirmed')">✓ Confirm</button>`:''}
          ${b.status==='confirmed'?`<button class="btn btn-primary btn-sm" onclick="updateStatus('${b._id}','completed')">Complete</button>`:''}
          ${b.paymentMode==='cod'&&b.status==='completed'&&b.paymentStatus!=='paid'?`<button class="btn btn-sm" style="background:#6366f1;color:#fff" onclick="markPaid('${b._id}')">Mark Paid</button>`:''}
          ${b.status!=='cancelled'&&b.status!=='completed'?`<button class="btn btn-danger btn-sm" onclick="updateStatus('${b._id}','cancelled')">Cancel</button>`:''}
        </div>
      </div>
    </div>`).join('');
}

async function updateStatus(id, status) {
  try { await API.bookings.updateStatus(id, status); showToast('Booking '+status,'success'); loadInbox(); renderInbox(hostBookings); } catch(e) { showToast(e.message,'error'); }
}
window.updateStatus = updateStatus;

async function markPaid(id) {
  try { await API.payments.markReceived(id); showToast('Payment marked as received!','success'); loadInbox(); } catch(e) { showToast(e.message,'error'); }
}
window.markPaid = markPaid;

async function filterInbox(status, btn) {
  document.querySelectorAll('.filter-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const filtered = status==='all' ? hostBookings : hostBookings.filter(b=>b.status===status);
  renderInbox(filtered);
}
window.filterInbox = filterInbox;

// Reviews
async function loadReviews() {
  if (!hostData) return;
  const d = await API.hosts.byId(hostData._id);
  const revs = d.reviews||[];
  document.getElementById('avgRating').textContent = hostData.rating||'—';
  document.getElementById('totalReviews').textContent = revs.length + ' reviews';
  document.getElementById('reviewsList').innerHTML = revs.map(r => `
    <div class="review-item">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary)">${(r.clientId?.fullName||'?')[0]}</div>
        <div><strong>${r.clientId?.fullName||'Anonymous'}</strong><div style="color:var(--accent);font-size:0.85rem">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div></div>
      </div>
      <p style="color:var(--text-muted);font-size:0.88rem">${r.comment}</p>
      ${r.hostReply?`<div style="background:rgba(255,202,40,0.06);border-left:3px solid var(--accent);padding:8px 12px;margin-top:8px;font-size:0.85rem"><strong>Your reply:</strong> ${r.hostReply}</div>`:'<button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="replyReview(\''+r._id+'\')">Reply</button>'}
    </div>`).join('') || '<p class="text-muted">No reviews yet.</p>';
}
window.replyReview = (id) => { const reply = prompt('Enter your reply:'); if (reply) showToast('Reply feature coming soon','info'); };

function showSection(id) {
  document.querySelectorAll('.dash-section').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l=>l.classList.remove('active'));
  const sec = document.getElementById('sec'+id.charAt(0).toUpperCase()+id.slice(1));
  if(sec) sec.classList.remove('hidden');
  const titles={overview:'Overview',business:'Business Setup',services:'Services Manager',slots:'Slot Manager',inbox:'Bookings Inbox',reviews:'Reviews & Ratings',earnings:'Earnings',notifs:'Notifications'};
  document.getElementById('topbarTitle').textContent = titles[id]||id;
  if(id==='services') loadServices();
  if(id==='slots') renderCalendar();
  if(id==='inbox') { loadInbox(); setTimeout(()=>renderInbox(hostBookings),300); }
  if(id==='reviews') loadReviews();

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

init();
