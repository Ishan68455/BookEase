const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const otpSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  phone: { type: String, default: '' },
  email: { type: String, default: '', lowercase: true },
  otp: { type: String, required: true }, // bcrypt hashed
  type: {
    type: String,
    enum: ['phone-signup', 'email-signup', 'phone-login', 'email-login', 'phone-forgot', 'email-forgot'],
    required: true
  },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  verified: { type: Boolean, default: false },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Compound indexes
otpSchema.index({ phone: 1, type: 1 });
otpSchema.index({ email: 1, type: 1 });

// Static: generate & hash OTP
otpSchema.statics.createOtp = async function(data) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);
  
  // Remove any previous unused OTP of same type+target
  const query = { type: data.type, used: false };
  if (data.phone) query.phone = data.phone;
  if (data.email) query.email = data.email;
  await this.deleteMany(query);
  
  const otpDoc = await this.create({
    ...data,
    otp: hashed,
    expiresAt
  });
  
  return { otpDoc, plainOtp: code };
};

// Instance: verify OTP
otpSchema.methods.verifyOtp = async function(plainOtp) {
  if (this.used) return { valid: false, reason: 'OTP already used' };
  if (this.verified) return { valid: false, reason: 'OTP already verified' };
  if (new Date() > this.expiresAt) return { valid: false, reason: 'OTP expired. Please request a new one.' };
  if (this.attempts >= this.maxAttempts) return { valid: false, reason: 'Too many attempts. Try again in 10 minutes.' };
  
  const isMatch = await bcrypt.compare(plainOtp, this.otp);
  if (!isMatch) {
    this.attempts += 1;
    await this.save();
    const remaining = this.maxAttempts - this.attempts;
    if (remaining <= 0) return { valid: false, reason: 'Too many attempts. Try again in 10 minutes.' };
    return { valid: false, reason: `Invalid OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.` };
  }
  
  this.verified = true;
  this.used = true;
  await this.save();
  return { valid: true };
};

module.exports = mongoose.model('Otp', otpSchema);
