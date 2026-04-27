const Booking = require('../models/Booking');
const Host = require('../models/Host');
const User = require('../models/User');
const Service = require('../models/Service');
const { sendReminderEmail } = require('./mailer');

async function scheduleReminders() {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Format for comparison (YYYY-MM-DD HH:MM)
    const targetDate = oneHourLater.toISOString().split('T')[0];
    const targetHour = oneHourLater.getHours().toString().padStart(2, '0');
    const targetMin = oneHourLater.getMinutes().toString().padStart(2, '0');
    const targetTime = `${targetHour}:${targetMin}`;

    const bookings = await Booking.find({
      bookingDate: targetDate,
      bookingTime: targetTime,
      status: { $in: ['pending', 'confirmed'] },
      reminderSent: false
    });

    for (const booking of bookings) {
      const client = await User.findById(booking.clientId);
      const host = await Host.findById(booking.hostId);
      const service = await Service.findById(booking.serviceId);

      if (client && host && service) {
        await sendReminderEmail({
          clientEmail: client.email,
          clientName: client.fullName,
          businessName: host.businessName,
          serviceName: service.name,
          bookingDate: booking.bookingDate,
          bookingTime: booking.bookingTime,
          bookingId: booking.bookingId
        });
        booking.reminderSent = true;
        await booking.save();
        console.log(`⏰ Reminder sent for booking ${booking.bookingId}`);
      }
    }
  } catch (err) {
    console.error('Scheduler error:', err.message);
  }
}

module.exports = { scheduleReminders };
