const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('../utils/passport');
const User = require('../models/User');
const Host = require('../models/Host');
const Otp = require('../models/Otp');
const { sendWhatsAppOTP, sendEmailOtp, checkRateLimit } = require('../utils/otpService');

function generateToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ==========================================
// OTP ENDPOINTS
// ==========================================

router.post('/send-phone-otp', async (req, res) => {
  try {
    const { phone, type } = req.body;
    if (!phone || !type) return res.status(400).json({ message: 'Phone and type required' });

    await checkRateLimit(phone, 'phone');

    if (type.includes('login') || type.includes('forgot')) {
      const user = await User.findOne({ phone });
      if (!user) return res.status(404).json({ message: 'Phone number not registered' });
    } else if (type === 'phone-signup') {
      const user = await User.findOne({ phone });
      if (user) return res.status(409).json({ message: 'Phone already registered. Please sign in.' });
    }

    const { plainOtp } = await Otp.createOtp({ phone, type });
    await sendWhatsAppOTP(phone, plainOtp);
    res.json({ message: 'OTP sent to WhatsApp' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/verify-phone-otp', async (req, res) => {
  try {
    const { phone, type, otp } = req.body;
    if (!phone || !type || !otp) return res.status(400).json({ message: 'Missing fields' });

    const otpDoc = await Otp.findOne({ phone, type, used: false }).sort({ createdAt: -1 });
    if (!otpDoc) return res.status(400).json({ message: 'OTP expired. Please request a new one.' });

    const result = await otpDoc.verifyOtp(otp);
    if (!result.valid) return res.status(400).json({ message: result.reason });

    res.json({ message: 'Phone verified successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/send-email-otp', async (req, res) => {
  console.log('📧 [send-email-otp] Route hit:', req.body);
  
  // Add 10 second timeout
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('📧 [send-email-otp] TIMEOUT after 10s');
      res.status(500).json({ message: 'Server timeout - please try again' });
    }
  }, 10000);

  try {
    const { email, type } = req.body;
    if (!email || !type) return res.status(400).json({ message: 'Email and type required' });

    await Promise.race([checkRateLimit(email.toLowerCase(), 'email'), new Promise((_, rej) => setTimeout(() => rej(new Error('DB timeout')), 8000))]);

    if (type.includes('login') || type.includes('forgot')) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(404).json({ message: 'Email not registered' });
    } else if (type === 'email-signup') {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) return res.status(409).json({ message: 'Email already registered. Please sign in.' });
    }

    const purpose = type.includes('login') ? 'login' : type.includes('forgot') ? 'forgot' : 'verification';
    console.log('📧 [send-email-otp] Creating OTP for:', email.toLowerCase(), 'purpose:', purpose);
    const { plainOtp } = await Otp.createOtp({ email: email.toLowerCase(), type });
    console.log('📧 [send-email-otp] OTP created, sending email...');
    await sendEmailOtp(email.toLowerCase(), plainOtp, purpose);
    console.log('📧 [send-email-otp] Email sent successfully');
    if (!res.headersSent) {
      res.json({ message: 'OTP sent to email' });
    }
  } catch (err) {
    console.error('📧 [send-email-otp] ERROR:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  } finally {
    clearTimeout(timeout);
  }
});

// TEMPORARY: Diagnostic endpoint — remove after fixing email
router.get('/test-email', async (req, res) => {
  const nodemailer = require('nodemailer');
  const info = {
    EMAIL_USER_SET: !!process.env.EMAIL_USER,
    EMAIL_PASS_SET: !!process.env.EMAIL_PASS,
    EMAIL_USER_VALUE: process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 4) + '***' : 'NOT SET',
    EMAIL_PASS_LENGTH: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
  };

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000
    });

    await transporter.verify();
    info.smtp_status = 'CONNECTED ✅';

    await transporter.sendMail({
      from: `"BookEase Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'BookEase SMTP Test',
      text: 'If you see this, email is working!'
    });
    info.test_send = 'SENT ✅';
  } catch (err) {
    info.smtp_error = err.message;
    info.smtp_code = err.code;
    info.full_error = err.toString();
  }

  res.json(info);
});

router.post('/verify-email-otp', async (req, res) => {
  try {
    const { email, type, otp } = req.body;
    if (!email || !type || !otp) return res.status(400).json({ message: 'Missing fields' });

    const otpDoc = await Otp.findOne({ email: email.toLowerCase(), type, used: false }).sort({ createdAt: -1 });
    if (!otpDoc) return res.status(400).json({ message: 'OTP expired. Please request a new one.' });

    const result = await otpDoc.verifyOtp(otp);
    if (!result.valid) return res.status(400).json({ message: result.reason });

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// MAIN AUTH ENDPOINTS
// ==========================================

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, role, whatsappNumber } = req.body;
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if OTPs were verified
    const phoneVerifiedDoc = await Otp.findOne({ phone, type: 'phone-signup', verified: true }).sort({ createdAt: -1 });
    const emailVerifiedDoc = await Otp.findOne({ email: email.toLowerCase(), type: 'email-signup', verified: true }).sort({ createdAt: -1 });
    
    if (!phoneVerifiedDoc || !emailVerifiedDoc) {
      return res.status(400).json({ message: 'Phone and Email must be verified first' });
    }

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) return res.status(409).json({ message: 'Email or phone already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName, 
      email: email.toLowerCase(), 
      phone, 
      passwordHash,
      role: role === 'host' ? 'host' : 'client',
      phoneVerified: true,
      emailVerified: true
    });

    if (user.role === 'host') {
      const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      await Host.create({
        userId: user._id,
        businessName: fullName + "'s Business",
        businessSlug: slug,
        whatsappNumber: whatsappNumber || phone
      });
    }

    // Cleanup OTPs
    await Otp.deleteMany({ $or: [{ phone }, { email: email.toLowerCase() }], type: { $in: ['phone-signup', 'email-signup'] } });

    const token = generateToken(user);
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, phone: user.phone, profileImage: user.profileImage }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (user.isSuspended) return res.status(403).json({ message: 'Account suspended. Contact support.' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, phone: user.phone, profileImage: user.profileImage }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login-with-otp', async (req, res) => {
  try {
    const { phone, email, type, otp } = req.body;
    
    let targetQuery = {};
    if (type === 'phone-login' && phone) {
      targetQuery = { phone, type, used: false };
    } else if (type === 'email-login' && email) {
      targetQuery = { email: email.toLowerCase(), type, used: false };
    } else {
      return res.status(400).json({ message: 'Invalid login parameters' });
    }

    const otpDoc = await Otp.findOne(targetQuery).sort({ createdAt: -1 });
    if (!otpDoc) return res.status(400).json({ message: 'OTP expired. Please request a new one.' });

    const result = await otpDoc.verifyOtp(otp);
    if (!result.valid) return res.status(400).json({ message: result.reason });

    // Login successful
    let userQuery;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      userQuery = {
        $or: [
          { phone: phone },
          { phone: cleanPhone },
          { phone: '+91' + cleanPhone },
          { phone: '91' + cleanPhone }
        ]
      };
    } else {
      userQuery = { email: email.toLowerCase() };
    }
    const user = await User.findOne(userQuery);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isSuspended) return res.status(403).json({ message: 'Account suspended' });

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, phone: user.phone, profileImage: user.profileImage }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// For backward compatibility / existing code
router.post('/forgot-password', async (req, res) => {
  res.status(400).json({ message: 'Please use send-email-otp or send-phone-otp with type forgot' });
});

router.post('/reset-password', async (req, res) => {
  try {
    const { phone, email, type, newPassword } = req.body;
    
    let targetQuery = {};
    if (type === 'phone-forgot' && phone) {
      targetQuery = { phone, type, verified: true };
    } else if (type === 'email-forgot' && email) {
      targetQuery = { email: email.toLowerCase(), type, verified: true };
    } else {
      return res.status(400).json({ message: 'Invalid reset parameters' });
    }

    const otpDoc = await Otp.findOne(targetQuery).sort({ createdAt: -1 });
    if (!otpDoc) return res.status(400).json({ message: 'Verification required before resetting password' });

    const user = await User.findOne(phone ? { phone } : { email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    // Cleanup
    await Otp.deleteMany(targetQuery);

    if (user.email) {
      await sendEmailOtp(user.email, null, 'password-reset-confirm');
    }

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// GOOGLE OAUTH
// ==========================================

router.get('/google-available', (req, res) => {
  const isSet = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'paste_your_client_id_here' && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id';
  res.json({ available: !!isSet });
});

router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'paste_your_client_id_here' || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id') {
    return res.redirect('/login.html?error=google_not_configured');
  }
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: (process.env.CLIENT_URL || 'http://localhost:5001') + '/login.html?error=google_failed' }),
  (req, res) => {
    try {
      const token = generateToken(req.user);
      const role = req.user.role || 'client';
      return res.redirect((process.env.CLIENT_URL || 'http://localhost:5001') + '/login.html?token=' + token + '&role=' + role);
    } catch (err) {
      console.error('Google callback error:', err);
      return res.redirect((process.env.CLIENT_URL || 'http://localhost:5001') + '/login.html?error=google_failed');
    }
  }
);

router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
