/* BookEase — booking.js */
let bookingState = { hostId:'', host:null, services:[], selectedService:null, selectedSlot:null, selectedDate:'', staffPref:null, currentStep:1 };
let calY, calM;

async function init() {
  const token = getToken();
  if (!token) { window.location.href = 'login.html?tab=signin'; return; }
  initTheme();
  const params = new URLSearchParams(window.location.search);
  bookingState.hostId = params.get('hostId') || '';
  if (!bookingState.hostId) { showToast('No host selected','error'); setTimeout(()=>window.location.href='client-dashboard.html',2000); return; }
  await loadHost();
  await loadServices();
  initCalendar();
}

async function loadHost() {
  try {
    const d = await API.hosts.byId(bookingState.hostId);
    bookingState.host = d.host;
    document.getElementById('sumHostName').textContent = d.host.businessName;
    document.getElementById('sumHostType').textContent = d.host.businessType;
    document.getElementById('sumHostImg').src = d.host.coverImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(d.host.businessName)}`;
    // Staff
    if (d.host.staff?.length) {
      document.getElementById('staffSection').style.display = 'block';
      document.getElementById('staffPills').innerHTML = d.host.staff.map(s =>
        `<button class="slot-pill" onclick="selectStaff('${s.name}',this)">${s.name}<br><span style="font-size:0.72rem;font-weight:400">${s.role}</span></button>`
      ).join('');
    }
  } catch(e) { showToast(e.message,'error'); }
}

async function loadServices() {
  document.getElementById('serviceSelectGrid').innerHTML = skeletonCards(4,'180px');
  try {
    const d = await API.services.byHost(bookingState.hostId);
    bookingState.services = d.services || [];
    renderServiceCards();
  } catch(e) { showToast(e.message,'error'); document.getElementById('serviceSelectGrid').innerHTML = '<p class="text-muted">Failed to load services</p>'; }
}

function renderServiceCards() {
  document.getElementById('serviceSelectGrid').innerHTML = bookingState.services.map(s => `
    <div class="service-select-card" id="svc_${s._id}" onclick="selectService('${s._id}')">
      <img class="service-select-img" src="${s.image||'https://placehold.co/400x100/1A1A2E/FFCA28?text='+encodeURIComponent(s.name)}" alt="${s.name}" loading="lazy">
      <div class="service-select-name">${s.name}</div>
      <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:6px">${s.category}</div>
      <div class="service-select-meta"><span class="service-select-price">₹${s.price}</span><span class="service-select-dur">⏱ ${s.duration}m</span></div>
    </div>`).join('');
}

function selectService(id) {
  bookingState.selectedService = bookingState.services.find(s=>s._id===id);
  document.querySelectorAll('.service-select-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('svc_'+id)?.classList.add('selected');
  document.getElementById('sumService').textContent = bookingState.selectedService.name;
  document.getElementById('sumTotal').textContent = '₹'+bookingState.selectedService.price;
  document.getElementById('sumDur').textContent = bookingState.selectedService.duration + ' mins';
}
window.selectService = selectService;

function selectStaff(name, btn) {
  bookingState.staffPref = name;
  document.querySelectorAll('#staffPills .slot-pill').forEach(p=>p.classList.remove('selected'));
  btn.classList.add('selected');
}
window.selectStaff = selectStaff;

// Calendar
const now2 = new Date(); calY=now2.getFullYear(); calM=now2.getMonth();
function initCalendar() { renderCal(); }
function renderCal() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonth').textContent = `${months[calM]} ${calY}`;
  const first = new Date(calY, calM, 1);
  const last = new Date(calY, calM+1, 0);
  const grid = document.getElementById('calGrid');
  let h = '<div class="calendar-day-label">Su</div><div class="calendar-day-label">Mo</div><div class="calendar-day-label">Tu</div><div class="calendar-day-label">We</div><div class="calendar-day-label">Th</div><div class="calendar-day-label">Fr</div><div class="calendar-day-label">Sa</div>';
  for(let i=0;i<first.getDay();i++) h+='<div class="calendar-day empty"></div>';
  const today = new Date(); today.setHours(0,0,0,0);
  for(let d=1;d<=last.getDate();d++) {
    const ds = `${calY}-${String(calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isPast = new Date(ds) < today;
    const isSel = ds === bookingState.selectedDate;
    const isToday = d===today.getDate()&&calM===today.getMonth()&&calY===today.getFullYear();
    h += `<div class="calendar-day ${isToday?'today':''} ${isPast?'past':''} ${isSel?'selected':''}" onclick="${isPast?'':''}`+ (isPast?'':` style="cursor:pointer" onclick="pickDate('${ds}')"`) + `>${d}</div>`;
  }
  grid.innerHTML = h;
  // Fix onclick in innerHTML
  grid.querySelectorAll('.calendar-day:not(.empty):not(.past)').forEach(el => {
    const d = el.textContent.trim();
    const ds = `${calY}-${String(calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => pickDate(ds));
  });
}
window.changeMonth = (dir) => { calM+=dir; if(calM>11){calM=0;calY++;} if(calM<0){calM=11;calY--;} renderCal(); };

async function pickDate(dateStr) {
  bookingState.selectedDate = dateStr;
  bookingState.selectedSlot = null;
  document.getElementById('sumDate').textContent = dateStr;
  document.getElementById('slotsDateLabel').textContent = dateStr;
  renderCal();
  document.getElementById('slotPills').innerHTML = '<p style="color:rgba(255,255,255,0.5);font-size:0.85rem">Loading slots...</p>';
  try {
    const d = await API.slots.available(bookingState.hostId, dateStr);
    const slots = d.slots || [];
    if (!slots.length) { document.getElementById('slotPills').innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:0.85rem">No slots available for this date.</p>'; return; }
    document.getElementById('slotPills').innerHTML = slots.map(sl =>
      `<button class="slot-pill ${sl.isBooked?'booked':''}" ${sl.isBooked?'disabled':''} id="slot_${sl._id}" onclick="pickSlot('${sl._id}','${sl.startTime}','${sl.endTime}',this)">${formatTime(sl.startTime)}</button>`
    ).join('');
  } catch(e) { showToast(e.message,'error'); }
}
window.pickDate = pickDate;

function pickSlot(id, start, end, btn) {
  bookingState.selectedSlot = { _id: id, startTime: start, endTime: end };
  document.querySelectorAll('.slot-pill').forEach(p=>p.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('sumTime').textContent = formatTime(start);
}
window.pickSlot = pickSlot;

let selectedPayment = 'cod';
function selectPayment(mode) {
  selectedPayment = mode;
  document.getElementById('payCod').classList.toggle('selected', mode==='cod');
  document.getElementById('payOnline').classList.toggle('selected', mode==='online');
  document.getElementById('sumPayment').textContent = mode==='cod' ? '💵 Pay at Shop' : '📱 Online (UPI)';
}
window.selectPayment = selectPayment;

function goStep(n) {
  if (n===2 && !bookingState.selectedService) { showToast('Please select a service first','error'); return; }
  if (n===4 && !bookingState.selectedSlot) { showToast('Please select a date and time slot','error'); return; }
  bookingState.currentStep = n;
  document.querySelectorAll('.step-panel').forEach((p,i)=>p.classList.toggle('active',i===n-1));
  [1,2,3,4].forEach(i=>{
    document.getElementById('sb'+i).className = 'step-bubble' + (i<n?' done':i===n?' active':'');
    document.getElementById('sl'+i).className = 'step-label' + (i<n?' done':i===n?' active':'');
    if(i<4) document.getElementById('sc'+i).classList.toggle('done',i<n);
  });
}
window.goStep = goStep;

async function confirmBooking() {
  if (!bookingState.selectedService || !bookingState.selectedSlot) { showToast('Please complete all steps','error'); return; }
  const btn = document.getElementById('confirmBtn');
  btn.classList.add('btn-loading'); btn.disabled = true;
  try {
    const res = await API.bookings.create({
      hostId: bookingState.hostId,
      serviceId: bookingState.selectedService._id,
      slotId: bookingState.selectedSlot._id,
      paymentMode: selectedPayment,
      specialNote: document.getElementById('specialNote').value,
      staffPreference: bookingState.staffPref
    });
    localStorage.setItem('be_lastBooking', JSON.stringify({
      bookingId: res.booking.bookingId,
      businessName: bookingState.host?.businessName,
      serviceName: bookingState.selectedService.name,
      bookingDate: bookingState.selectedDate,
      bookingTime: bookingState.selectedSlot.startTime,
      amount: bookingState.selectedService.price,
      paymentMode: selectedPayment,
      duration: bookingState.selectedService.duration
    }));
    if (selectedPayment === 'online') { startQrFlow(res.booking._id); }
    else { window.location.href = 'confirmation.html'; }
  } catch(e) { showToast(e.message,'error'); btn.classList.remove('btn-loading'); btn.disabled=false; }
}
window.confirmBooking = confirmBooking;

function startQrFlow(bookingDbId) {
  document.getElementById('qrAmount').textContent = '₹' + bookingState.selectedService.price;
  openModal('qrModal');
  let count = 5;
  const progress = document.getElementById('qrProgress');
  const countdown = document.getElementById('qrCountdown');
  const timer = setInterval(async () => {
    count--;
    countdown.textContent = count;
    progress.style.width = ((5-count)/5*100) + '%';
    if (count <= 0) {
      clearInterval(timer);
      try {
        await API.payments.confirmOnline(bookingDbId);
        document.getElementById('qrPayContent').style.display = 'none';
        document.getElementById('qrSuccess').style.display = 'block';
        setTimeout(() => { closeModal('qrModal'); window.location.href = 'confirmation.html'; }, 1500);
      } catch(e) { showToast(e.message,'error'); closeModal('qrModal'); }
    }
  }, 1000);
}

init();
