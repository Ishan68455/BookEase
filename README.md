# BookEase

BookEase is a premium, full-stack online booking management system designed for independent service providers and their clients. It features a dark-luxury aesthetic, real-time availability, dual payment options, and automated notifications.

## Features

- **Multi-Role Authentication**: Secure login and dashboards for Clients, Hosts, and Platform Admins using JWT.
- **Real-Time Booking**: Interactive calendar and slot management. No double bookings.
- **Dual Payments**: Pay online (simulated via QR) or choose Cash on Delivery (Pay at Shop).
- **Automated Notifications**: Email alerts via Nodemailer and WhatsApp alerts via Twilio.
- **Premium UI/UX**: "Dark Luxury" design system with responsive grid layouts, glassmorphism, and CSS animations.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript.
- **Backend**: Node.js, Express.js.
- **Database**: MongoDB (Mongoose).
- **Real-Time**: Socket.io.
- **Authentication**: JWT & bcryptjs.
- **Background Jobs**: node-cron.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB account (Atlas or local)
- (Optional) Twilio Account for WhatsApp notifications
- (Optional) Gmail App Password for email notifications

### Installation

1. Clone the repository.
2. Navigate to the `server` directory and install dependencies:
   ```bash
   cd server
   npm install
   ```
3. Set up the environment variables:
   Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```
   *Note: Set `MONGO_URI` to your MongoDB connection string.*
4. Start the server:
   ```bash
   npm start
   # Or use npm run dev for nodemon
   ```
5. Open the frontend:
   You can serve the `client/` folder using any static server (like VS Code Live Server or python's http.server) or simply open `client/pages/index.html` in your browser.

## Default Roles
- You can register as a Client or a Host directly from the Sign Up page.
- For Admin access, you will need to manually set the `role` field to `admin` in your MongoDB database for a specific user.

## License

This project is licensed under the MIT License.
