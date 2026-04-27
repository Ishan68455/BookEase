const express = require('express');
const router = express.Router();
const Host = require('../models/Host');
const User = require('../models/User');
const Service = require('../models/Service');
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const upload = require('../middleware/upload');

// GET /api/hosts — public list with search/filter
router.get('/', async (req, res) => {
  try {
    const { search, category, city, minRating, page = 1, limit = 12 } = req.query;
    let query = { isActive: true };
    if (category) query.businessType = category;
    if (city) query['location.city'] = { $regex: city, $options: 'i' };
    if (minRating) query.rating = { $gte: parseFloat(minRating) };

    let hosts = await Host.find(query).populate('userId', 'fullName email').lean();

    // Fuzzy search
    if (search) {
      const s = search.toLowerCase();
      hosts = hosts.filter(h =>
        h.businessName?.toLowerCase().includes(s) ||
        h.description?.toLowerCase().includes(s) ||
        h.businessType?.toLowerCase().includes(s)
      );
    }

    // Add min service price
    for (let h of hosts) {
      const services = await Service.find({ hostId: h._id, isActive: true }).select('price');
      h.minPrice = services.length ? Math.min(...services.map(s => s.price)) : 0;
    }

    const skip = (page - 1) * limit;
    const total = hosts.length;
    const paginated = hosts.slice(skip, skip + parseInt(limit));

    res.json({ hosts: paginated, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/hosts/my — host's own profile
router.get('/my', auth, roleCheck('host'), async (req, res) => {
  try {
    const host = await Host.findOne({ userId: req.user._id });
    if (!host) return res.status(404).json({ message: 'Host profile not found' });
    res.json({ host });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/hosts/slug/:slug — public host profile page
router.get('/slug/:slug', async (req, res) => {
  try {
    const host = await Host.findOne({ businessSlug: req.params.slug, isActive: true }).lean();
    if (!host) return res.status(404).json({ message: 'Host not found' });
    const services = await Service.find({ hostId: host._id, isActive: true });
    const reviews = await Review.find({ hostId: host._id }).populate('clientId', 'fullName profileImage').sort('-createdAt').limit(10);
    res.json({ host, services, reviews });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/hosts/:id — public single host
router.get('/:id', async (req, res) => {
  try {
    const host = await Host.findById(req.params.id).lean();
    if (!host) return res.status(404).json({ message: 'Host not found' });
    const services = await Service.find({ hostId: host._id, isActive: true });
    const reviews = await Review.find({ hostId: host._id }).populate('clientId', 'fullName profileImage').sort('-createdAt').limit(10);
    res.json({ host, services, reviews });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/hosts/my — update own host profile
router.put('/my', auth, roleCheck('host'), async (req, res) => {
  try {
    const updates = req.body;
    const host = await Host.findOneAndUpdate({ userId: req.user._id }, updates, { new: true, runValidators: true });
    res.json({ message: 'Profile updated', host });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/hosts/upload-cover — upload cover image
router.post('/upload-cover', auth, roleCheck('host'), upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = `${process.env.BASE_URL}/uploads/${req.file.filename}`;
    await Host.findOneAndUpdate({ userId: req.user._id }, { coverImage: url });
    res.json({ url });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/hosts/upload-gallery — upload multiple gallery images
router.post('/upload-gallery', auth, roleCheck('host'), upload.array('gallery', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
    const urls = req.files.map(f => `${process.env.BASE_URL}/uploads/${f.filename}`);
    const host = await Host.findOneAndUpdate({ userId: req.user._id }, { $push: { galleryImages: { $each: urls } } }, { new: true });
    res.json({ urls, galleryImages: host.galleryImages });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/hosts/toggle-favorite — client toggle favorite host
router.post('/toggle-favorite', auth, roleCheck('client'), async (req, res) => {
  try {
    const { hostId } = req.body;
    const user = await User.findById(req.user._id);
    const idx = user.favorites.indexOf(hostId);
    if (idx > -1) user.favorites.splice(idx, 1);
    else user.favorites.push(hostId);
    await user.save();
    res.json({ favorites: user.favorites });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/hosts/favorites/list — client's favorite hosts
router.get('/favorites/list', auth, roleCheck('client'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json({ favorites: user.favorites });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
