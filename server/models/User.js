const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String },
  role: { type: String, enum: ['client', 'host', 'admin'], default: 'client' },
  profileImage: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  googleId: { type: String, default: '' },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  otp: { type: String },
  otpExpiry: { type: Date },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Host' }],
  deviceTokens: [{
    token: String,
    device: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],
}, { timestamps: true });

userSchema.methods.comparePassword = async function(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > new Date();
};

module.exports = mongoose.model('User', userSchema);
