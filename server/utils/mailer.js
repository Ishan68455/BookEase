const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const brandColor = '#FFCA28';
const dark = '#0D0D0D';

function htmlWrapper(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'DM Sans',Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
    .wrap{max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)}
    .header{background:${dark};padding:32px;text-align:center}
    .header h1{color:${brandColor};margin:0;font-size:28px;letter-spacing:1px}
    .header p{color:#aaa;margin:4px 0 0;font-size:13px}
    .body{padding:32px}
    .body h2{color:${dark};margin-top:0}
    .body p{color:#444;line-height:1.7;margin:8px 0}
    .badge{display:inline-block;background:${brandColor};color:${dark};padding:6px 16px;border-radius:50px;font-weight:700;font-size:14px;margin:8px 0}
    .info-row{background:#f9f9f9;border-radius:10px;padding:16px;margin:16px 0}
    .info-row .label{color:#888;font-size:12px;margin:0 0 2px}
    .info-row .value{color:${dark};font-size:15px;font-weight:600;margin:0}
    .btn{display:inline-block;background:${brandColor};color:${dark};padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:16px}
    .footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#aaa}
  </style></head><body><div class="wrap">
    <div class="header"><h1>📅 BookEase</h1><p>Book smarter. Serve better.</p></div>
    <div class="body">${content}</div>
    <div class="footer">© ${new Date().getFullYear()} BookEase. All rights reserved.<br>This is an automated notification.</div>
  </div></body></html>`;
}

async function sendBookingConfirmationToClient(data) {
  const { clientEmail, clientName, businessName, serviceName, bookingDate, bookingTime, bookingId, amount, paymentMode } = data;
  const html = htmlWrapper(`
    <h2>Booking Confirmed ✅</h2>
    <p>Hi <strong>${clientName}</strong>, your appointment is confirmed!</p>
    <div class="info-row">
      <p class="label">Business</p><p class="value">${businessName}</p>
    </div>
    <div class="info-row">
      <p class="label">Service</p><p class="value">${serviceName}</p>
    </div>
    <div class="info-row">
      <p class="label">Date & Time</p><p class="value">${bookingDate} at ${bookingTime}</p>
    </div>
    <div class="info-row">
      <p class="label">Amount</p><p class="value">₹${amount} · ${paymentMode === 'cod' ? 'Pay at Shop' : 'Online (Paid)'}</p>
    </div>
    <div class="info-row">
      <p class="label">Booking ID</p><p class="value">#${bookingId}</p>
    </div>
    <p style="margin-top:24px;color:#888;font-size:13px">Please arrive 5 minutes early. Cancellation must be done at least 2 hours before your appointment.</p>
  `);
  await transporter.sendMail({
    from: `"BookEase" <${process.env.EMAIL_USER}>`,
    to: clientEmail,
    subject: `Booking Confirmed ✓ — ${businessName}`,
    html
  });
}

async function sendBookingAlertToHost(data) {
  const { hostEmail, hostName, clientName, clientPhone, serviceName, bookingDate, bookingTime, bookingId, paymentMode } = data;
  const html = htmlWrapper(`
    <h2>🔔 New Booking Alert</h2>
    <p>Hi <strong>${hostName}</strong>, you have a new booking!</p>
    <div class="info-row">
      <p class="label">Client</p><p class="value">${clientName}</p>
    </div>
    <div class="info-row">
      <p class="label">Phone</p><p class="value">${clientPhone}</p>
    </div>
    <div class="info-row">
      <p class="label">Service</p><p class="value">${serviceName}</p>
    </div>
    <div class="info-row">
      <p class="label">Date & Time</p><p class="value">${bookingDate} at ${bookingTime}</p>
    </div>
    <div class="info-row">
      <p class="label">Payment</p><p class="value">${paymentMode === 'cod' ? '💵 Cash on Delivery' : '💳 Online (Paid)'}</p>
    </div>
    <div class="info-row">
      <p class="label">Booking ID</p><p class="value">#${bookingId}</p>
    </div>
    <a href="${process.env.BASE_URL?.replace('5000','') || '#'}/client/pages/host-dashboard.html" class="btn">View Dashboard →</a>
  `);
  await transporter.sendMail({
    from: `"BookEase" <${process.env.EMAIL_USER}>`,
    to: hostEmail,
    subject: `New Booking Alert — ${clientName} booked ${serviceName}`,
    html
  });
}

async function sendOtpEmail(email, otp) {
  const html = htmlWrapper(`
    <h2>Password Reset OTP 🔑</h2>
    <p>Use the OTP below to reset your BookEase password. It expires in <strong>10 minutes</strong>.</p>
    <div style="text-align:center;margin:32px 0">
      <span style="font-size:48px;font-weight:900;letter-spacing:12px;color:#0D0D0D">${otp}</span>
    </div>
    <p style="color:#888;font-size:13px">If you didn't request this, please ignore this email.</p>
  `);
  await transporter.sendMail({
    from: `"BookEase" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your BookEase OTP Code',
    html
  });
}

async function sendReminderEmail(data) {
  const { clientEmail, clientName, businessName, serviceName, bookingDate, bookingTime, bookingId } = data;
  const html = htmlWrapper(`
    <h2>⏰ Appointment Reminder</h2>
    <p>Hi <strong>${clientName}</strong>, your appointment is <strong>1 hour away!</strong></p>
    <div class="info-row">
      <p class="label">Business</p><p class="value">${businessName}</p>
    </div>
    <div class="info-row">
      <p class="label">Service</p><p class="value">${serviceName}</p>
    </div>
    <div class="info-row">
      <p class="label">Time</p><p class="value">${bookingDate} at ${bookingTime}</p>
    </div>
    <p>Booking ID: <strong>#${bookingId}</strong></p>
    <p style="color:#888;font-size:13px">See you soon! 🙌</p>
  `);
  await transporter.sendMail({
    from: `"BookEase" <${process.env.EMAIL_USER}>`,
    to: clientEmail,
    subject: `⏰ Reminder: Your appointment at ${businessName} is in 1 hour`,
    html
  });
}

module.exports = { sendBookingConfirmationToClient, sendBookingAlertToHost, sendOtpEmail, sendReminderEmail };
