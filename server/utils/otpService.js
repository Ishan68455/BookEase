const axios = require('axios');
const nodemailer = require('nodemailer');
const Otp = require('../models/Otp');

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000
  });
}

const brandColor = '#FFCA28';
const dark = '#0D0D0D';

async function checkRateLimit(target, field) { return; // temporarily disabled
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const query = { createdAt: { $gte: oneHourAgo } };
  query[field] = target;
  const count = await Otp.countDocuments(query);
  if (count >= 5) {
    throw new Error('Too many OTP requests. Please try again after some time.');
  }
}

const sendWhatsAppOTP = async (phone, otp) => {
  try {
    const num = String(phone).replace(/\D/g, '');
    const whatsappPhone = num.startsWith('91') ? num : '91' + num;

    const response = await axios.post(
      `https://api.green-api.com/waInstance${process.env.GREEN_API_ID}/sendMessage/${process.env.GREEN_API_TOKEN}`,
      {
        chatId: whatsappPhone + '@c.us',
        message: `🔐 *BookEase OTP Verification*\n\nYour OTP is: *${otp}*\n\n⏱ Valid for 10 minutes.\n🚫 Do not share this with anyone.\n\n— BookEase Team`
      }
    );

    console.log(`✅ WhatsApp OTP sent to ${phone}`, response.data);
    return { success: true };

  } catch (error) {
    console.error('WhatsApp OTP error:', error.message);
    console.log('='.repeat(50));
    console.log(`🔐 DEV OTP: ${otp}`);
    console.log(`📱 Phone: ${phone}`);
    console.log('='.repeat(50));
    return { success: false, fallback: true };
  }
};

async function sendEmailOtp(email, otp, purpose = 'verification') {
  console.log(`📧 sendEmailOtp called — email: ${email}, purpose: ${purpose}, otp: ${otp ? '****' : 'null'}`);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('📧 EMAIL_USER or EMAIL_PASS not set in environment!');
    console.log('='.repeat(50));
    console.log(`🔐 DEV EMAIL OTP: ${otp}`);
    console.log(`📧 Email: ${email}`);
    console.log('='.repeat(50));
    return true;
  }
  
  const subjectMap = {
    verification: 'BookEase Email Verification',
    login: 'BookEase Login OTP',
    forgot: 'BookEase Password Reset OTP',
    'password-reset-confirm': 'Your BookEase password was reset'
  };
  
  const subject = subjectMap[purpose] || 'BookEase Verification';
  
  try {
    if (purpose === 'password-reset-confirm') {
      const html = emailWrapper(`
        <h2 style="color:${dark};margin-top:0;font-size:24px">Password Reset Successful 🔒</h2>
        <p style="color:#444;line-height:1.7;font-size:15px">Your BookEase password has been successfully reset.</p>
        <p style="color:#444;line-height:1.7;font-size:15px">If you didn't make this change, please contact our support immediately.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${process.env.BASE_URL || 'http://localhost:5001'}/login.html" 
             style="display:inline-block;background:${brandColor};color:${dark};padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700">
            Sign In Now →
          </a>
        </div>
      `);
      await getTransporter().sendMail({
        from: `"BookEase" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your BookEase password was reset',
        html
      });
      return true;
    }
    
    const html = emailWrapper(`
      <h2 style="color:${dark};margin-top:0;font-size:24px">${
        purpose === 'forgot' ? 'Password Reset OTP 🔑' : 
        purpose === 'login' ? 'Login Verification 🔐' : 
        'Email Verification ✉️'
      }</h2>
      <p style="color:#444;line-height:1.7;font-size:15px">Your verification code is:</p>
      <div style="text-align:center;margin:32px 0">
        <div style="display:inline-block;background:linear-gradient(135deg,#f8f8f8,#fff);border:2px solid ${brandColor};border-radius:16px;padding:24px 40px;box-shadow:0 4px 24px rgba(255,202,40,0.15)">
          <span style="font-size:48px;font-weight:900;letter-spacing:12px;color:${dark};font-family:'DM Sans',Arial,monospace">${otp}</span>
        </div>
      </div>
      <p style="color:#888;font-size:14px;text-align:center;margin:16px 0">
        This code expires in <strong>10 minutes</strong>
      </p>
      <div style="background:#f9f9f9;border-radius:10px;padding:16px;margin-top:24px">
        <p style="color:#999;font-size:13px;margin:0;text-align:center">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `);
    
    await getTransporter().sendMail({
      from: `"BookEase" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html
    });
    
    console.log(`✅ Email OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error('📧 Email OTP send error:', error.message);
    console.log('='.repeat(50));
    console.log(`🔐 DEV EMAIL OTP: ${otp}`);
    console.log(`📧 Email: ${email}`);
    console.log('='.repeat(50));
    // Don't throw — let the flow continue so the OTP modal still opens
    return true;
  }
}

function emailWrapper(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{font-family:'DM Sans',Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
    .wrap{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)}
    .header{background:${dark};padding:32px;text-align:center}
    .header h1{color:${brandColor};margin:0;font-size:28px;letter-spacing:1px}
    .header p{color:#aaa;margin:4px 0 0;font-size:13px}
    .body{padding:32px}
    .footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#aaa}
  </style></head><body><div class="wrap">
    <div class="header"><h1>📅 BookEase</h1><p>Book smarter. Serve better.</p></div>
    <div class="body">${content}</div>
    <div class="footer">© ${new Date().getFullYear()} BookEase. All rights reserved.<br>This is an automated notification.</div>
  </div></body></html>`;
}

module.exports = { sendWhatsAppOTP, sendEmailOtp, checkRateLimit };
