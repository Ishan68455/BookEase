const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const Host = require('../models/Host');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const upload = require('../middleware/upload');

// GET /api/services/host/:hostId
router.get('/host/:hostId', async (req, res) => {
  try {
    const services = await Service.find({ hostId: req.params.hostId, isActive: true });
    res.json({ services });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/services/my — host's own services
router.get('/my', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    if (!host) return res.status(404).json({ message: 'Host not found' });
    const services = await Service.find({ hostId: host._id });
    res.json({ services });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/services — create service
router.post('/', auth, roleCheck('host'), upload.single('image'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    if (!host) return res.status(404).json({ message: 'Host not found' });
    const { name, description, price, duration, category } = req.body;
    const imageUrl = req.file ? `${process.env.BASE_URL}/uploads/${req.file.filename}` : '';
    const service = await Service.create({ hostId: host._id, name, description, price: parseFloat(price), duration: parseInt(duration), category, image: imageUrl });
    res.status(201).json({ message: 'Service created', service });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/services/:id
router.put('/:id', auth, roleCheck('host'), upload.single('image'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    const updates = { ...req.body };
    if (req.file) updates.image = `${process.env.BASE_URL}/uploads/${req.file.filename}`;
    const service = await Service.findOneAndUpdate({ _id: req.params.id, hostId: host._id }, updates, { new: true });
    if (!service) return res.status(404).json({ message: 'Service not found' });
    res.json({ message: 'Service updated', service });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/services/:id
router.delete('/:id', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    await Service.findOneAndDelete({ _id: req.params.id, hostId: host._id });
    res.json({ message: 'Service deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
