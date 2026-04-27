const express = require('express');
const router = express.Router();
const Slot = require('../models/Slot');
const Host = require('../models/Host');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// GET /api/slots?hostId=&date= — public: get available slots for a date
router.get('/', async (req, res) => {
  try {
    const { hostId, date } = req.query;
    if (!hostId || !date) return res.status(400).json({ message: 'hostId and date required' });
    const slots = await Slot.find({ hostId, date, isBlocked: false }).sort('startTime');
    res.json({ slots });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/slots/my — host's all slots
router.get('/my', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    const { month } = req.query; // YYYY-MM
    let query = { hostId: host._id };
    if (month) query.date = { $regex: `^${month}` };
    const slots = await Slot.find(query).sort('date startTime');
    res.json({ slots });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/slots — create slot(s)
router.post('/', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    const { slots } = req.body; // array of { date, startTime, endTime, staffId }
    const results = [];
    for (const slot of slots) {
      try {
        const s = await Slot.create({ hostId: host._id, ...slot });
        results.push(s);
      } catch (e) { /* skip duplicate */ }
    }
    res.status(201).json({ message: `${results.length} slots created`, slots: results });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/slots/:id/block — host block a slot
router.put('/:id/block', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    const slot = await Slot.findOneAndUpdate({ _id: req.params.id, hostId: host._id }, { isBlocked: true }, { new: true });
    res.json({ slot });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/slots/:id
router.delete('/:id', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    await Slot.findOneAndDelete({ _id: req.params.id, hostId: host._id, isBooked: false });
    res.json({ message: 'Slot deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/slots/bulk-week — repeat weekly schedule
router.post('/bulk-week', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    const { startDate, weeks, dailySlots } = req.body; // dailySlots: [{day:0-6, startTime, endTime}]
    const results = [];
    for (let w = 0; w < weeks; w++) {
      for (const ds of dailySlots) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + w * 7 + ds.day);
        const dateStr = d.toISOString().split('T')[0];
        try {
          const s = await Slot.create({ hostId: host._id, date: dateStr, startTime: ds.startTime, endTime: ds.endTime });
          results.push(s);
        } catch (e) { /* skip duplicate */ }
      }
    }
    res.status(201).json({ message: `${results.length} slots created`, count: results.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
