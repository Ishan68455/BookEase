require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: (process.env.BASE_URL || 'http://localhost:5001') + '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) return done(null, user);
    
    user = await User.findOne({ email: profile.emails[0].value });
    
    if (user) {
      user.googleId = profile.id;
      user.authProvider = 'google';
      await user.save();
      return done(null, user);
    }
    
    // New user — create directly
    const newUser = await User.create({
      fullName: profile.displayName,
      email: profile.emails[0].value,
      googleId: profile.id,
      profileImage: profile.photos[0].value,
      role: 'client',
      phone: 'google-' + profile.id
    });
    
    return done(null, newUser);
    
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id ? user._id.toString() : user.googleId);
});

passport.deserializeUser(async (id, done) => {
  try {
    const mongoose = require('mongoose');
    let user;
    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await User.findById(id);
    } else {
      user = await User.findOne({ googleId: id });
    }
    if (user) return done(null, user);
    done(null, null);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;