const mongoose = require('mongoose');

const helpSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address']
  },

  type: {
    type: String,
    enum: ['Feedback', 'Bug Report', 'Booking Issue', 'Host Support', 'General Inquiry'],
    default: 'General Inquiry'
  },

  message: {
    type: String,
    required: true,
    minlength: 10
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Help', helpSchema);