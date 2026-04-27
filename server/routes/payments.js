const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Host = require('../models/Host');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// POST /api/payments/confirm-cod — confirm COD booking
router.post('/confirm-cod', auth, roleCheck('client'), async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ _id: bookingId, clientId: req.user._id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    booking.paymentMode = 'cod';
    booking.paymentStatus = 'pending'; // paid at shop
    booking.status = 'confirmed';
    await booking.save();
    res.json({ message: 'COD booking confirmed', booking });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/payments/confirm-online — dummy online payment confirm
router.post('/confirm-online', auth, roleCheck('client'), async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ _id: bookingId, clientId: req.user._id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    booking.paymentMode = 'online';
    booking.paymentStatus = 'paid'; // demo
    booking.status = 'confirmed';
    await booking.save();
    res.json({ message: 'Payment received (demo)', booking, transactionId: 'DEMO-' + Date.now() });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/payments/:bookingId/received — host marks COD as received
router.put('/:bookingId/received', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.bookingId, hostId: host._id, paymentMode: 'cod' },
      { paymentStatus: 'paid', status: 'completed' },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Payment marked as received', booking });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* =====================================================================
   RAZORPAY REAL INTEGRATION (commented out — uncomment for production)
   =====================================================================
const Razorpay = require('razorpay');
const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

router.post('/create-order', auth, async (req, res) => {
  const { amount } = req.body;
  const order = await razorpay.orders.create({ amount: amount * 100, currency: 'INR', receipt: 'receipt_' + Date.now() });
  res.json({ orderId: order.id, amount: order.amount });
});

router.post('/verify', auth, async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`).digest('hex');
  if (expected !== signature) return res.status(400).json({ message: 'Invalid signature' });
  res.json({ success: true });
});
===================================================================== */

module.exports = router;
