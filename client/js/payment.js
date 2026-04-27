/* BookEase — payment.js (standalone payment helpers) */
// This file is already handled inside booking.js QR flow.
// Reserved for future Razorpay real integration.

/*
async function initRazorpay(amount, bookingId) {
  const { orderId } = await API.payments.createOrder(amount);
  const options = {
    key: 'YOUR_RAZORPAY_KEY_ID',
    amount: amount * 100,
    currency: 'INR',
    name: 'BookEase',
    description: 'Appointment Booking',
    order_id: orderId,
    handler: async (response) => {
      await API.payments.verifyRazorpay(response);
      window.location.href = 'confirmation.html';
    },
    theme: { color: '#FFCA28' }
  };
  const rzp = new Razorpay(options);
  rzp.open();
}
*/
