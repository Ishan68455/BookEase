/* BookEase — auth.js */

let selectedRole = 'client';

// Global state for OTP flows
let currentFlow = ''; // 'signup', 'login-otp', 'forgot'
let currentAuthType = 'phone'; // 'phone' or 'email'
let currentContact = ''; 
let signupData = {};
let resendTimerInterval = null;

// ==========================================
// INITIALIZATION & URL PARAMS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Check URL for Google OAuth success
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const userStr = params.get('user');
  
  if (token && userStr) {
    try {
      const user = JSON.parse(decodeURIComponent(userStr));
      localStorage.setItem('be_token', token);
      localStorage.setItem('be_user', JSON.stringify(user));
      showToast('Login successful via Google!', 'success');
      setTimeout(() => redirectByRole(user.role), 1000);
      return;
    } catch (e) {
      console.error('Google Auth parsing error', e);
    }
  }

  // Pre-select tabs if needed
  if (params.get('tab') === 'signup') switchTab('signup');
  if (params.get('role') === 'host') { switchTab('signup'); selectRole('host'); }

  // Redirect if already logged in (and no new token just passed)
  const existingToken = localStorage.getItem('be_token');
  if (existingToken && !token) {
    const user = JSON.parse(localStorage.getItem('be_user') || '{}');
    if (user.role) redirectByRole(user.role);
  }

  initOtpInputs();
});

// ==========================================
// UI NAVIGATION
// ==========================================
function selectRole(role) {
  selectedRole = role;
  document.getElementById('selectedRole').value = role;
  document.getElementById('roleClient').classList.toggle('selected', role === 'client');
  document.getElementById('roleHost').classList.toggle('selected', role === 'host');
  const waGroup = document.getElementById('whatsappGroup');
  if (waGroup) waGroup.style.display = role === 'host' ? 'block' : 'none';
}

function switchTab(tab) {
  document.querySelectorAll('.auth-tab:not(#tabForgotPhone):not(#tabForgotEmail)').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('forgotPanel').style.display = 'none';
  
  const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
  if (tabBtn) tabBtn.classList.add('active');
  const panel = document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.classList.add('active');
  document.getElementById('authTabs').style.display = 'flex';
}
window.switchTab = switchTab;

function showForgot() {
  currentFlow = 'forgot';
  setupAlternativeAuthUI('Reset Password 🔑', 'How would you like to verify?');
}
window.showForgot = showForgot;

function showOtpLogin() {
  currentFlow = 'login-otp';
  setupAlternativeAuthUI('Login with OTP 🔐', 'Choose how you want to sign in');
}
window.showOtpLogin = showOtpLogin;

function setupAlternativeAuthUI(title, subtitle) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('authTabs').style.display = 'none';
  document.getElementById('forgotPanel').style.display = 'block';
  
  document.querySelectorAll('.forgot-step').forEach(s => s.classList.remove('active'));
  document.getElementById('forgotStep1').classList.add('active');
  
  document.getElementById('forgotTitle').textContent = title;
  document.getElementById('forgotSubtitle').textContent = subtitle;
  switchForgotTab('phone');
}

function hideForgot() {
  document.getElementById('forgotPanel').style.display = 'none';
  document.getElementById('authTabs').style.display = 'flex';
  switchTab('signin');
}
window.hideForgot = hideForgot;

function switchForgotTab(type) {
  currentAuthType = type;
  document.getElementById('tabForgotPhone').classList.toggle('active', type === 'phone');
  document.getElementById('tabForgotEmail').classList.toggle('active', type === 'email');
  
  document.getElementById('forgotPhoneForm').style.display = type === 'phone' ? 'block' : 'none';
  document.getElementById('forgotEmailForm').style.display = type === 'email' ? 'block' : 'none';
}
window.switchForgotTab = switchForgotTab;

// ==========================================
// STANDARD LOGIN
// ==========================================
document.getElementById('signinForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('signinEmail').value.trim();
  const pass = document.getElementById('signinPass').value;
  let valid = true;
  if (!email || !/\S+@\S+\.\S+/.test(email)) { showErr('signinEmailErr'); valid = false; } else hideErr('signinEmailErr');
  if (!pass) { showErr('signinPassErr'); valid = false; } else hideErr('signinPassErr');
  if (!valid) return;
  
  const btn = document.getElementById('signinBtn');
  setLoading(btn, true);
  try {
    const data = await API.auth.login({ email, password: pass });
    localStorage.setItem('be_token', data.token);
    localStorage.setItem('be_user', JSON.stringify(data.user));
    showToast('Welcome back, ' + data.user.fullName + '!', 'success');
    setTimeout(() => redirectByRole(data.user.role), 800);
  } catch(err) {
    showToast(err.message, 'error');
  } finally { setLoading(btn, false); }
});

// ==========================================
// SIGNUP FLOW (Phone -> Email -> Register)
// ==========================================
async function startSignupFlow() {
  currentFlow = 'signup';
  
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const pass = document.getElementById('signupPass').value;
  const confirm = document.getElementById('signupConfirm').value;
  
  let valid = true;
  if (!name) { showErr('signupNameErr'); valid = false; } else hideErr('signupNameErr');
  if (!email || !/\S+@\S+\.\S+/.test(email)) { showErr('signupEmailErr'); valid = false; } else hideErr('signupEmailErr');
  if (!phone) { showErr('signupPhoneErr'); valid = false; } else hideErr('signupPhoneErr');
  if (!pass || pass.length < 8) { showErr('signupPassErr'); valid = false; } else hideErr('signupPassErr');
  if (pass !== confirm) { showErr('signupConfirmErr'); valid = false; } else hideErr('signupConfirmErr');
  if (!valid) return;

  const waNum = (document.getElementById('regWhatsapp')?.value || '').replace(/\D/g, '');

  signupData = { fullName: name, email, phone, password: pass, role: selectedRole, whatsappNumber: waNum };

  // 1. Send Phone OTP
  const btn = document.getElementById('signupInitialBtn');
  setLoading(btn, true);
  try {
    currentAuthType = 'phone';
    currentContact = phone;
    await API.auth.sendPhoneOtp({ phone, type: 'phone-signup' });
    openOtpModal('Verify Your WhatsApp', `Enter the 6-digit code sent to your WhatsApp (${phone})`);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}
window.startSignupFlow = startSignupFlow;

async function handleSignupPhoneVerified() {
  // Phone is verified. Now trigger Email OTP.
  try {
    showToast('Phone verified! Now verifying email...', 'success');
    currentAuthType = 'email';
    currentContact = signupData.email;
    
    // Slight delay so user sees success state
    setTimeout(async () => {
      clearOtpInputs();
      closeOtpModal();
      
      try {
        await API.auth.sendEmailOtp({ email: currentContact, type: 'email-signup' });
        openOtpModal('Verify Your Email', `Enter the 6-digit code sent to ${currentContact}`);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }, 1000);
  } catch(err) {
    console.error(err);
  }
}

async function handleSignupEmailVerified() {
  // Both verified. Complete registration.
  closeOtpModal();
  fireConfetti();
  
  try {
    const data = await API.auth.register(signupData);
    localStorage.setItem('be_token', data.token);
    localStorage.setItem('be_user', JSON.stringify(data.user));
    showToast('Account Created! 🎉', 'success');
    setTimeout(() => redirectByRole(data.user.role), 1500);
  } catch (err) {
    showToast('Error creating account: ' + err.message, 'error');
  }
}

// ==========================================
// ALTERNATIVE AUTH SENDER (Login/Forgot)
// ==========================================
async function sendAuthOtp(type) {
  currentAuthType = type;
  
  if (type === 'phone') {
    currentContact = document.getElementById('forgotPhone').value.trim();
    if (!currentContact) return showToast('Enter your phone number', 'error');
  } else {
    currentContact = document.getElementById('forgotEmail').value.trim();
    if (!currentContact || !/\S+@\S+\.\S+/.test(currentContact)) return showToast('Enter a valid email', 'error');
  }

  const btnId = type === 'phone' ? 'btnForgotPhone' : 'btnForgotEmail';
  const btn = document.getElementById(btnId);
  setLoading(btn, true);

  try {
    const actionType = `${type}-${currentFlow === 'login-otp' ? 'login' : 'forgot'}`;
    
    if (type === 'phone') {
      await API.auth.sendPhoneOtp({ phone: currentContact, type: actionType });
    } else {
      await API.auth.sendEmailOtp({ email: currentContact, type: actionType });
    }
    
    const title = currentFlow === 'login-otp' ? 'Login Verification' : 'Reset Password';
    const contactMsg = type === 'phone' ? `your WhatsApp (${currentContact})` : currentContact;
    openOtpModal(title, `Enter the 6-digit code sent to ${contactMsg}`);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}
window.sendAuthOtp = sendAuthOtp;

// ==========================================
// GLOBAL OTP VERIFIER
// ==========================================
async function verifyGlobalOtp() {
  const otp = getOtpValue();
  if (otp.length < 6) return showToast('Enter the complete 6-digit code', 'error');

  const btn = document.getElementById('btnVerifyOtp');
  setLoading(btn, true);

  try {
    if (currentFlow === 'signup') {
      if (currentAuthType === 'phone') {
        await API.auth.verifyPhoneOtp({ phone: currentContact, type: 'phone-signup', otp });
        handleSignupPhoneVerified();
      } else {
        await API.auth.verifyEmailOtp({ email: currentContact, type: 'email-signup', otp });
        handleSignupEmailVerified();
      }
    } 
    else if (currentFlow === 'login-otp') {
      const payload = { type: `${currentAuthType}-login`, otp };
      if (currentAuthType === 'phone') payload.phone = currentContact;
      else payload.email = currentContact;
      
      const data = await API.auth.loginWithOtp(payload);
      closeOtpModal();
      localStorage.setItem('be_token', data.token);
      localStorage.setItem('be_user', JSON.stringify(data.user));
      showToast('Welcome back, ' + data.user.fullName + '!', 'success');
      setTimeout(() => redirectByRole(data.user.role), 800);
    }
    else if (currentFlow === 'forgot') {
      // Just verify OTP, then move to Step 2
      if (currentAuthType === 'phone') {
        await API.auth.verifyPhoneOtp({ phone: currentContact, type: 'phone-forgot', otp });
      } else {
        await API.auth.verifyEmailOtp({ email: currentContact, type: 'email-forgot', otp });
      }
      closeOtpModal();
      document.querySelectorAll('.forgot-step').forEach(s => s.classList.remove('active'));
      document.getElementById('forgotStep2').classList.add('active');
    }
    
    document.querySelectorAll('.otp-input').forEach(i => i.classList.add('success'));
    
  } catch (err) {
    document.querySelectorAll('.otp-input').forEach(i => {
      i.classList.add('error');
      setTimeout(() => i.classList.remove('error'), 500);
    });
    showToast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}
window.verifyGlobalOtp = verifyGlobalOtp;

async function resendGlobalOtp() {
  const btn = document.getElementById('btnResendOtp');
  if (btn.disabled) return;
  
  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  try {
    const actionType = `${currentAuthType}-${currentFlow === 'login-otp' ? 'login' : currentFlow === 'forgot' ? 'forgot' : 'signup'}`;
    if (currentAuthType === 'phone') {
      await API.auth.sendPhoneOtp({ phone: currentContact, type: actionType });
    } else {
      await API.auth.sendEmailOtp({ email: currentContact, type: actionType });
    }
    showToast('Code resent successfully', 'success');
    startResendTimer();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Resend Code';
  }
}
window.resendGlobalOtp = resendGlobalOtp;

// ==========================================
// RESET PASSWORD (Final Step)
// ==========================================
async function resetPassword() {
  const np = document.getElementById('newPass').value;
  const cp = document.getElementById('confirmNewPass').value;
  if (!np || np.length < 8) return showToast('Password must be at least 8 characters', 'error');
  if (np !== cp) return showToast('Passwords do not match', 'error');
  
  const btn = document.getElementById('btnResetPass');
  setLoading(btn, true);
  
  try {
    const payload = { type: `${currentAuthType}-forgot`, newPassword: np };
    if (currentAuthType === 'phone') payload.phone = currentContact;
    else payload.email = currentContact;
    
    await API.auth.resetPassword(payload);
    showToast('Password reset successful! Please sign in.', 'success');
    setTimeout(() => {
      hideForgot();
    }, 1500);
  } catch(err) { 
    showToast(err.message, 'error'); 
  } finally {
    setLoading(btn, false);
  }
}
window.resetPassword = resetPassword;

// ==========================================
// OTP MODAL & INPUT UTILS
// ==========================================
function openOtpModal(title, subtitle) {
  document.getElementById('otpModalTitle').textContent = title;
  document.getElementById('otpModalSubtitle').textContent = subtitle;
  clearOtpInputs();
  document.getElementById('globalOtpModal').classList.add('active');
  startResendTimer();
  setTimeout(() => document.getElementById('otp_0')?.focus(), 100);
}

function closeOtpModal() {
  document.getElementById('globalOtpModal').classList.remove('active');
  if (resendTimerInterval) clearInterval(resendTimerInterval);
}
window.closeOtpModal = closeOtpModal;

function initOtpInputs() {
  const container = document.getElementById('otpInputContainer');
  if (!container) return;
  
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 1;
    input.className = 'otp-input';
    input.id = `otp_${i}`;
    input.dataset.index = i;
    
    // Auto advance
    input.addEventListener('input', (e) => {
      input.value = input.value.replace(/[^0-9]/g, ''); // Numbers only
      if (input.value && i < 5) {
        document.getElementById(`otp_${i+1}`).focus();
      }
    });
    
    // Backspace handling
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        document.getElementById(`otp_${i-1}`).focus();
      }
      if (e.key === 'Enter') {
        verifyGlobalOtp();
      }
    });
    
    // Paste handling
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (text) {
        for (let j = 0; j < Math.min(6, text.length); j++) {
          const target = document.getElementById(`otp_${j}`);
          if (target) target.value = text[j];
        }
        const nextFocus = Math.min(5, text.length);
        document.getElementById(`otp_${nextFocus}`).focus();
      }
    });
    
    container.appendChild(input);
  }
}

function clearOtpInputs() {
  for (let i = 0; i < 6; i++) {
    const inp = document.getElementById(`otp_${i}`);
    if (inp) {
      inp.value = '';
      inp.classList.remove('success', 'error');
    }
  }
}

function getOtpValue() {
  let val = '';
  for (let i = 0; i < 6; i++) {
    const inp = document.getElementById(`otp_${i}`);
    if (inp) val += inp.value;
  }
  return val;
}

function startResendTimer() {
  const btn = document.getElementById('btnResendOtp');
  btn.disabled = true;
  let timeLeft = 30;
  
  if (resendTimerInterval) clearInterval(resendTimerInterval);
  
  resendTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(resendTimerInterval);
      btn.textContent = 'Resend Code';
      btn.disabled = false;
    } else {
      btn.textContent = `Resend in ${timeLeft}s`;
    }
  }, 1000);
}

// ==========================================
// HELPERS
// ==========================================
function redirectByRole(role) {
  const map = { client: 'client-dashboard.html', host: 'host-dashboard.html', admin: 'admin-dashboard.html' };
  window.location.href = map[role] || 'client-dashboard.html';
}

function showErr(id) { 
  const el = document.getElementById(id); 
  if (el) { 
    el.classList.add('visible'); 
    el.previousElementSibling?.querySelector?.('input')?.classList?.add('error'); 
  } 
}
function hideErr(id) { 
  const el = document.getElementById(id); 
  if (el) { 
    el.classList.remove('visible'); 
    el.previousElementSibling?.querySelector?.('input')?.classList?.remove('error');
  } 
}
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) { 
    btn.classList.add('btn-loading'); 
    btn.disabled = true; 
    btn.dataset.orig = btn.textContent; 
    btn.textContent = 'Please wait...'; 
  } else { 
    btn.classList.remove('btn-loading'); 
    btn.disabled = false; 
    btn.textContent = btn.dataset.orig || btn.textContent; 
  }
}

function fireConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = -10 + 'px';
    confetti.style.backgroundColor = ['#FFCA28', '#00C896', '#FF4C60', '#6366f1'][Math.floor(Math.random() * 4)];
    confetti.style.animation = `fall ${Math.random() * 3 + 2}s linear forwards`;
    container.appendChild(confetti);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fall {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => {
    container.remove();
    style.remove();
  }, 5000);
}
window.fireConfetti = fireConfetti;
