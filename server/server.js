require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Frontend
app.use(express.static(path.join(__dirname, '../client/pages')));
app.use('/css', express.static(path.join(__dirname, '../client/css')));
app.use('/js', express.static(path.join(__dirname, '../client/js')));
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));
app.use('/manifest.json', express.static(path.join(__dirname, '../client/manifest.json')));
// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

// Socket.io — Real-time slot updates
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  socket.on('join-host-room', (hostId) => socket.join(`host-${hostId}`));
  socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
});
global.io = io;
// Passport initialization
const session = require('express-session');
const passport = require('./utils/passport');

app.use(session({
  secret: 'bookease123',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/hosts', require('./routes/hosts'));
app.use('/api/services', require('./routes/services'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'BookEase API Running 🚀' }));

// Scheduler — Booking reminders 1hr before
const { scheduleReminders } = require('./utils/scheduler');
cron.schedule('* * * * *', scheduleReminders); // runs every minute, checks for 1hr window

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 BookEase Server running on port ${PORT}`));
