const express = require('express');
const router = express.Router();
const SibApiV3Sdk = require('sib-api-v3-sdk');
const Help = require('../models/help'); // Import the Help model
require('dotenv').config(); // Import dotenv to load environment variables

// Initialize the API key for Sendinblue from environment variables
const apiKey = process.env.SIB_API_KEY;
SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = apiKey;

// Route for contact form submission

router.post('/help/submit', (req, res) => {
  const { name, email, type, message } = req.body;

  // Validation: Check if all fields are provided
  if (!name || !email || !type || !message) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/listings');
  }

  // Validate email format
  const emailRegex = /.+@.+\..+/;
  if (!email.match(emailRegex)) {
    req.flash('error', 'Please enter a valid email address.');
    return res.redirect('/listings');
  }

  // Check if the message is too short (must be at least 10 characters)
  if (message.length < 10) {
    req.flash('error', 'Message must be at least 10 characters long.');
    return res.redirect('/listings');
  }

  // Create a new help query instance based on the submitted data
  const newHelpQuery = new Help({
    name,
    email,
    type,
    message,
  });



  // Save the help query to the database
  newHelpQuery.save()
    .then(() => {
      // Prepare the email data
      const emailData = {
        sender: { email: 'wanderheavn2025@gmail.com', name: name },
        to: [{ email: 'wanderheavn2025@gmail.com' }],
        subject: `New Help Query from ${name} - ${type}`,
      
  htmlContent: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
    <div style="background-color: #ff3f4b; padding: 20px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
      <h2 style="margin: 0;">WanderHeavn</h2>
    </div>

    <div style="padding: 20px;">
      <h3 style="color: #ff3f4b;">You've received a new Help Query!</h3>
      <p>Hi <strong>WanderHeavn Team</strong>,</p>
      <p><strong>${name}</strong> has submitted a help request. Below are the details:</p>

      <table style="width: 100%; margin-top: 20px;">
        <tr>
          <td style="font-weight: bold; color: #ff3f4b;">Name:</td>
          <td>${name}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #ff3f4b;">Email:</td>
          <td>${email}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #ff3f4b;">Query Type:</td>
          <td>${type}</td>
        </tr>
      </table>

      <p style="margin-top: 20px;"><strong style="color: #ff3f4b;">Message:</strong><br>${message}</p>
    </div>

    <hr style="margin: 30px 0;">

    <div style="text-align: center; color: #777;">
      Need help? <a href="mailto:wanderheavn2025@gmail.com" style="color: #ff3f4b;">Contact WanderHeavn Support</a> anytime.<br>
      <p style="margin-top: 10px; font-size: 13px;">© 2025 <span style="color: #ff3f4b;">WanderHeavn</span>. All rights reserved.</p>
    </div>
  </div>
`


      };

      // Initialize the Sendinblue API client
      const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

      // Sending the email through Sendinblue
      tranEmailApi.sendTransacEmail(emailData)
        .then((response) => {
          console.log('Email sent successfully:', response);
          req.flash('success', 'Your message has been received. We\'ll get back to you soon.');
          res.redirect('/listings');
        })
        .catch((err) => {
          console.error('Error sending email:', err);
          req.flash('error', 'Something went wrong. Please try again later.');
          res.redirect('/listings');
        });
    })
    .catch((err) => {
      console.error('Error saving to database:', err);
      req.flash('error', 'Could not save your query. Please try again later.');
      res.redirect('/listings');
    });
});

// Export the router to use it in app.js
module.exports = router;