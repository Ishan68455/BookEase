const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  duration: { type: Number, required: true, min: 5 }, // in minutes
  category: {
    type: String,
    enum: ['Hair','Skin','Wellness','Business','Legal','Medical','Fitness','Beauty','Spa','Other'],
    default: 'Other'
  },
  image: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
