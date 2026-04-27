const axios = require('axios');

// const API_URL = `https://7107.api.greenapi.com`;
const API_URL = `https://api.green-api.com`;
const ID = process.env.GREEN_API_ID;
const TOKEN = process.env.GREEN_API_TOKEN;

async function sendWA(phone, message) {
  try {
    let num = String(phone).replace(/\D/g, '');
    if (num.length === 10) num = '91' + num;

    const res = await axios.post(
      `${API_URL}/waInstance${ID}/sendMessage/${TOKEN}`,
      { chatId: num + '@c.us', message: message }
    );
    console.log('✅ WhatsApp sent:', res.data);
    return { sent: true };
  } catch(e) {
    console.error('❌ WhatsApp error:', e.message);
    return { sent: false };
  }
}

async function sendWhatsAppToHost(data) {
  const { hostPhone, clientName, serviceName, bookingDate, bookingTime, bookingId, paymentMode } = data;
  const message = `📅 *New Booking — BookEase*\n\n👤 Client: ${clientName}\n💆 Service: ${serviceName}\n📆 Date: ${bookingDate}\n⏰ Time: ${bookingTime}\n💳 Payment: ${paymentMode === 'cod' ? 'Cash on Delivery' : 'Online (Paid)'}\n🔖 Booking ID: #${bookingId}\n\nLogin to dashboard to confirm.`;
  return await sendWA(hostPhone, message);
}

async function sendWhatsAppToClient(data) {
  const { clientPhone, clientName, businessName, serviceName, bookingDate, bookingTime, bookingId } = data;
  const message = `✅ *Booking Confirmed — BookEase*\n\nHi ${clientName}! 👋\n🏪 Business: ${businessName}\n💆 Service: ${serviceName}\n📆 Date: ${bookingDate}\n⏰ Time: ${bookingTime}\n🔖 Booking ID: #${bookingId}\n\nSee you soon! 🙌`;
  return await sendWA(clientPhone, message);
}

function generateWaMeLink(phone, message) {
  const encoded = encodeURIComponent(message);
  const clean = phone?.replace(/\D/g, '') || '';
  return `https://wa.me/${clean}?text=${encoded}`;
}

module.exports = { sendWhatsAppToHost, sendWhatsAppToClient, generateWaMeLink };