const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Host = require('../models/Host');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// GET /api/admin/stats
router.get('/stats', auth, roleCheck('admin'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [totalUsers, totalHosts, totalBookings, todayBookings, pendingHosts] = await Promise.all([
      User.countDocuments({ role: 'client' }),
      Host.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ bookingDate: today }),
      Host.countDocuments({ isVerified: false })
    ]);
    res.json({ totalUsers, totalHosts, totalBookings, todayBookings, pendingHosts });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/users
router.get('/users', auth, roleCheck('admin'), async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    let query = {};
    if (role) query.role = role;
    const users = await User.find(query).select('-passwordHash').sort('-createdAt')
      .skip((page - 1) * limit).limit(parseInt(limit));
    const total = await User.countDocuments(query);
    res.json({ users, total });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/admin/users/:id/suspend
router.put('/users/:id/suspend', auth, roleCheck('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isSuspended: req.body.suspend }, { new: true });
    res.json({ message: req.body.suspend ? 'User suspended' : 'User unsuspended', user });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/hosts
router.get('/hosts', auth, roleCheck('admin'), async (req, res) => {
  try {
    const hosts = await Host.find().populate('userId', 'fullName email phone').sort('-createdAt');
    res.json({ hosts });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/admin/hosts/:id/verify
router.put('/hosts/:id/verify', auth, roleCheck('admin'), async (req, res) => {
  try {
    const host = await Host.findByIdAndUpdate(req.params.id, { isVerified: req.body.verify }, { new: true });
    res.json({ message: req.body.verify ? 'Host verified' : 'Verification revoked', host });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/bookings — all bookings
router.get('/bookings', auth, roleCheck('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const bookings = await Booking.find()
      .populate('clientId', 'fullName email')
      .populate('hostId', 'businessName')
      .populate('serviceId', 'name price')
      .sort('-createdAt')
      .skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Booking.countDocuments();
    res.json({ bookings, total });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/export-csv
router.get('/export-csv', auth, roleCheck('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('clientId', 'fullName email phone')
      .populate('hostId', 'businessName')
      .populate('serviceId', 'name price')
      .sort('-createdAt');
    
    const header = 'Booking ID,Client,Email,Phone,Business,Service,Date,Time,Status,Payment Mode,Payment Status,Amount\n';
    const rows = bookings.map(b =>
      `${b.bookingId},"${b.clientId?.fullName}",${b.clientId?.email},${b.clientId?.phone},"${b.hostId?.businessName}","${b.serviceId?.name}",${b.bookingDate},${b.bookingTime},${b.status},${b.paymentMode},${b.paymentStatus},${b.amount}`
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bookease-bookings.csv');
    res.send(header + rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
