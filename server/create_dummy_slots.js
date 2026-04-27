const mongoose = require('mongoose');
require('dotenv').config();
const Slot = require('./models/Slot');
const hostId = "69ee1fe81482c4dd51978f0b";

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const slots = [
    { hostId, date: "2026-04-27", startTime: "10:00", endTime: "10:30", isBooked: false },
    { hostId, date: "2026-04-27", startTime: "11:00", endTime: "11:30", isBooked: false },
    { hostId, date: "2026-04-27", startTime: "14:00", endTime: "14:30", isBooked: false },
    { hostId, date: "2026-04-27", startTime: "15:00", endTime: "15:30", isBooked: false },
  ];
  await Slot.insertMany(slots);
  console.log("Dummy slots created for 2026-04-27!");
  process.exit(0);
});
