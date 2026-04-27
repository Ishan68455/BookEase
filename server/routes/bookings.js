const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Host = require('../models/Host');
const User = require('../models/User');
const Service = require('../models/Service');
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { sendBookingConfirmationToClient, sendBookingAlertToHost } = require('../utils/mailer');
const { sendWhatsAppToClient, sendWhatsAppToHost } = require('../utils/whatsapp');

// POST /api/bookings — create booking
router.post('/', auth, roleCheck('client'), async (req, res) => {
  try {
    const { hostId, serviceId, slotId, paymentMode, specialNote, staffPreference } = req.body;
    const slot = await Slot.findById(slotId);
    if (!slot || slot.isBooked || slot.isBlocked) return res.status(400).json({ message: 'Slot not available' });
    const service = await Service.findById(serviceId);
    const host = await Host.findById(hostId);
    const client = await User.findById(req.user._id);

    // Lock the slot
    slot.isBooked = true;
    slot.bookedBy = req.user._id;
    await slot.save();

    const booking = await Booking.create({
      clientId: req.user._id, hostId, serviceId, slotId,
      bookingDate: slot.date, bookingTime: slot.startTime,
      paymentMode, specialNote, staffPreference,
      amount: service.price,
      status: 'pending'
    });

    // Increment host booking count
    await Host.findByIdAndUpdate(hostId, { $inc: { totalBookings: 1 } });

    // Real-time socket notification to host
    if (global.io) global.io.to(`host-${hostId}`).emit('new-booking', booking);

    // Email notifications (async, don't block)
    const hostUser = await User.findById(host.userId);
    Promise.all([
      sendBookingConfirmationToClient({
        clientEmail: client.email, clientName: client.fullName,
        businessName: host.businessName, serviceName: service.name,
        bookingDate: booking.bookingDate, bookingTime: booking.bookingTime,
        bookingId: booking.bookingId, amount: service.price, paymentMode
      }).then(() => { booking.notificationsSent.email = true; booking.save(); }).catch(console.error),
      sendBookingAlertToHost({
        hostEmail: hostUser?.email, hostName: host.businessName,
        clientName: client.fullName, clientPhone: client.phone,
        serviceName: service.name, bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime, bookingId: booking.bookingId, paymentMode
      }).catch(console.error),
      sendWhatsAppToClient({
        clientPhone: client.phone, clientName: client.fullName,
        businessName: host.businessName, serviceName: service.name,
        bookingDate: booking.bookingDate, bookingTime: booking.bookingTime,
        bookingId: booking.bookingId
      }).catch(console.error),
      sendWhatsAppToHost({
        hostPhone: host.whatsappNumber, clientName: client.fullName,
        serviceName: service.name, bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime, bookingId: booking.bookingId, paymentMode
      }).catch(console.error)
    ]);

    res.status(201).json({ message: 'Booking confirmed!', booking, host, service });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/bookings/my — client's bookings
router.get('/my', auth, roleCheck('client'), async (req, res) => {
  try {
    const { status } = req.query;
    let query = { clientId: req.user._id };
    if (status && status !== 'all') query.status = status;
    const bookings = await Booking.find(query)
      .populate('hostId', 'businessName coverImage location')
      .populate('serviceId', 'name price duration category')
      .sort('-createdAt');
    res.json({ bookings });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/bookings/host — host's bookings inbox
router.get('/host', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    const { status } = req.query;
    let query = { hostId: host._id };
    if (status && status !== 'all') query.status = status;
    const bookings = await Booking.find(query)
      .populate('clientId', 'fullName email phone profileImage')
      .populate('serviceId', 'name price duration')
      .sort('-createdAt');
    res.json({ bookings });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/bookings/:id — single booking details
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('hostId', 'businessName coverImage location whatsappNumber')
      .populate('serviceId', 'name price duration')
      .populate('clientId', 'fullName email phone');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/bookings/:id/status — host update booking status
router.put('/:id/status', auth, roleCheck('host', 'admin'), async (req, res) => {
  try {
    const { status, cancellationReason } = req.body;
    const booking = await Booking.findByIdAndUpdate(req.params.id,
      { status, ...(cancellationReason && { cancellationReason }) },
      { new: true }
    );
    // If cancelled or completed, free the slot so it can be deleted or reused
    if (status === 'cancelled' || status === 'completed') {
      await Slot.findByIdAndUpdate(booking.slotId, { isBooked: false, bookedBy: null });
    }
    if (global.io) global.io.to(`host-${booking.hostId}`).emit('booking-updated', booking);
    res.json({ message: 'Status updated', booking });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/bookings/:id/cancel — client cancel
router.put('/:id/cancel', auth, roleCheck('client'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, clientId: req.user._id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    
    // Check cancellation window (2hr before)
    const bookingDateTime = new Date(`${booking.bookingDate}T${booking.bookingTime}`);
    const now = new Date();
    const diffHrs = (bookingDateTime - now) / (1000 * 60 * 60);
    
    const host = await Host.findById(booking.hostId);
    if (host?.cancellationPolicy === 'none') return res.status(400).json({ message: 'This booking cannot be cancelled' });
    const minHrs = host?.cancellationPolicy === '24hr' ? 24 : 2;
    if (diffHrs < minHrs) return res.status(400).json({ message: `Cancellation must be done ${minHrs} hours before appointment` });

    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason || 'Cancelled by client';
    await booking.save();
    await Slot.findByIdAndUpdate(booking.slotId, { isBooked: false, bookedBy: null });
    res.json({ message: 'Booking cancelled', booking });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/bookings/can-review/:hostId — check if client can review
router.get('/can-review/:hostId', auth, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      clientId: req.user._id,
      hostId: req.params.hostId,
      status: 'completed',
      reviewed: { $ne: true }
    });
    
    if (booking) {
      res.json({ canReview: true, bookingId: booking._id });
    } else {
      res.json({ canReview: false });
    }
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/bookings/:id/review — client submit review
router.post('/:id/review', auth, roleCheck('client'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, clientId: req.user._id, status: 'completed' });
    if (!booking) return res.status(400).json({ message: 'Can only review completed bookings' });
    const existing = await Review.findOne({ bookingId: booking._id });
    if (existing) return res.status(409).json({ message: 'Already reviewed' });

    const { rating, comment } = req.body;
    const review = await Review.create({ bookingId: booking._id, clientId: req.user._id, hostId: booking.hostId, rating, comment });

    // Mark booking as reviewed
    await Booking.findByIdAndUpdate(req.params.id, { reviewed: true });

    // Update host rating
    const allReviews = await Review.find({ hostId: booking.hostId });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await Host.findByIdAndUpdate(booking.hostId, { rating: avgRating.toFixed(1), totalReviews: allReviews.length });

    res.status(201).json({ message: 'Review submitted', review });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/bookings/host/stats — host dashboard stats
router.get('/host/stats', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    const [totalBookings, todayBookings, completedBookings, reviews] = await Promise.all([
      Booking.countDocuments({ hostId: host._id }),
      Booking.countDocuments({ hostId: host._id, bookingDate: today }),
      Booking.find({ hostId: host._id, status: 'completed' }),
      Review.find({ hostId: host._id })
    ]);

    const revenue = completedBookings.reduce((sum, b) => sum + b.amount, 0);
    const monthRevenue = completedBookings.filter(b => b.bookingDate.startsWith(thisMonth)).reduce((sum, b) => sum + b.amount, 0);
    const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 0;

    // Monthly chart data (last 6 months)
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const m = d.toISOString().slice(0, 7);
      const count = await Booking.countDocuments({ hostId: host._id, bookingDate: { $regex: `^${m}` }, status: 'completed' });
      chartData.push({ month: m, bookings: count });
    }

    res.json({ totalBookings, todayBookings, revenue, monthRevenue, avgRating, totalReviews: reviews.length, chartData });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
