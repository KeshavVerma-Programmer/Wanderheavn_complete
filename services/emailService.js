require('dotenv').config();

const SibApiV3Sdk = require('sib-api-v3-sdk');
const apiKey = process.env.SIB_API_KEY; 

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

defaultClient.authentications['api-key'].apiKey = apiKey;

const sendBookingConfirmationEmail = async (userEmail, booking) => {
  const sender = { email: 'wanderheavn2025@gmail.com', name: 'WanderHeavn Team' };
  const toRecipient = [{ email: userEmail }];
  
  const checkIn = new Date(booking.bookedDates[0]);
  const lastBooked = new Date(booking.bookedDates[booking.bookedDates.length - 1]);
  const checkOut = new Date(lastBooked);
  checkOut.setDate(checkOut.getDate() + 1);  
  
  const totalPrice = booking.totalPrice; 

  const subject = `Congratulations! You successfully booked a listing on WanderHeavn`;
  const htmlContent = `
<div style="font-family: Arial, sans-serif; background-color: #ffffff; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #fe424d; padding: 20px; text-align: center;">
      <h1 style="font-size: 26px; font-weight: bold; color: #f9f9f9; margin: 0;">
        WanderHeavn
      </h1>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      
      <h2 style="color: #fe424d; margin-bottom: 10px;">You're going to ${booking.property.location}!</h2>
      
     <p style="font-size: 16px; color: #444; margin-bottom: 20px;">
  Hi <strong style="color: #fe424d;">${booking.guest.username}</strong>,
  <br><br>
  Your booking at <strong style="color: #fe424d;">${booking.property.title}</strong> is <strong style="color: green;">confirmed</strong>!<br>
  We can't wait to host you.
</p>

      <!-- Trip Details -->
      <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
        <h3 style="color: #333; font-size: 20px; margin-bottom: 10px;">Your trip details</h3>
        
        <table style="width: 100%; font-size: 16px; color: #555;">
          <tr>
            <td style="padding: 8px 0;"><strong style="color: #fe424d;">Check-In</strong></td>
            <td style="padding: 8px 0; text-align: right;">${checkIn.toDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong style="color: #fe424d;">Check-Out</strong></td>
            <td style="padding: 8px 0; text-align: right;">${checkOut.toDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong style="color: #fe424d;">Total Price</strong></td>
            <td style="padding: 8px 0; text-align: right;">₹${totalPrice}</td>
          </tr>
        </table>
      </div>

      <!-- Listing Information -->
      <div style="margin-top: 30px;">
        <h3 style="color: #333; font-size: 20px; margin-bottom: 10px;">Listing Information</h3>
        <p style="font-size: 16px; color: #555;">
          <strong style="color: #fe424d;">${booking.property.title}</strong><br>
          ${booking.property.location}, ${booking.property.country}
        </p>
      </div>

      <!-- Help Section -->
      <div style="margin-top: 30px;">
        <p style="font-size: 16px; color: #777;">
          Need help? <a href="mailto:support@wanderheavn.com" style="color: #fe424d; text-decoration: none;">Contact WanderHeavn Support</a> anytime.
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #fafafa; padding: 15px; text-align: center; font-size: 12px; color: #999;">
      &copy; 2025 <span style="color: #fe424d;">WanderHeavn</span>. All rights reserved.
    </div>

  </div>
</div>
`;
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = sender;
    sendSmtpEmail.to = toRecipient;
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`Email sent successfully: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
module.exports = { sendBookingConfirmationEmail };