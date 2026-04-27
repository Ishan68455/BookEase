const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, default: () => 'BK' + uuidv4().slice(0,8).toUpperCase(), unique: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', required: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  bookingDate: { type: String, required: true }, // YYYY-MM-DD
  bookingTime: { type: String, required: true }, // HH:MM
  staffPreference: { type: String, default: null },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentMode: { type: String, enum: ['cod', 'online'], default: 'cod' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  amount: { type: Number, required: true },
  specialNote: { type: String, default: '' },
  cancellationReason: { type: String, default: '' },
  reviewed: { type: Boolean, default: false },
  reminderSent: { type: Boolean, default: false },
  notificationsSent: {
    email: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false }
  },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
