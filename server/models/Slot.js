const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', required: true },
  staffId: { type: String, default: null }, // for multi-staff
  date: { type: String, required: true }, // YYYY-MM-DD format
  startTime: { type: String, required: true }, // HH:MM 24hr
  endTime: { type: String, required: true },
  isBooked: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Compound index to prevent duplicate slots
slotSchema.index({ hostId: 1, date: 1, startTime: 1, staffId: 1 }, { unique: true });

module.exports = mongoose.model('Slot', slotSchema);
