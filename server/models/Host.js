const mongoose = require('mongoose');

const workingHoursSchema = new mongoose.Schema({
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
  isOpen: { type: Boolean, default: false },
  startTime: { type: String, default: '09:00' },
  endTime: { type: String, default: '18:00' }
}, { _id: false });

const hostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  businessName: { type: String, required: true, trim: true },
  businessSlug: { type: String, unique: true, lowercase: true, trim: true },
  businessType: {
    type: String,
    enum: ['Barber','Salon','Consultant','Spa','Clinic','Tattoo','Fitness','Legal','Medical','Beauty','Wellness','Other'],
    default: 'Other'
  },
  description: { type: String, default: '' },
  location: { city: String, address: String, coordinates: { lat: Number, lng: Number } },
  coverImage: { type: String, default: '' },
  galleryImages: [{ type: String }],
  profileImage: { type: String, default: '' },
  workingHours: [workingHoursSchema],
  whatsappNumber: { type: String, default: '' },
  socialLinks: {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },
  },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  totalBookings: { type: Number, default: 0 },
  cancellationPolicy: { type: String, enum: ['24hr', '2hr', 'none'], default: '2hr' },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  badge: { type: String, enum: ['Top Rated', 'Most Booked', 'New', ''], default: 'New' },
  staff: [{ name: String, role: String, image: String }],
}, { timestamps: true });

// Auto-generate slug from businessName
hostSchema.pre('save', function(next) {
  if (this.isModified('businessName') && !this.businessSlug) {
    this.businessSlug = this.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  next();
});

module.exports = mongoose.model('Host', hostSchema);
