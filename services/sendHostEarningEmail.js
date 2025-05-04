require('dotenv').config();
const SibApiV3Sdk = require('sib-api-v3-sdk');

const apiKey = process.env.SIB_API_KEY;
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

defaultClient.authentications['api-key'].apiKey = apiKey;

const sendHostEarningEmail = async (hostEmail, booking) => {
  const sender = { email: 'wanderheavn2025@gmail.com', name: 'WanderHeavn Team' };
  const toRecipient = [{ email: hostEmail }];
  
  const title = booking.property.title;
  const totalPrice = booking.totalPrice;
  const guestName = booking.guest.username;
  const location = booking.property.location;

  const earningsAfterCommission = totalPrice - (totalPrice * 0.10);

  const subject = `Booking Confirmed for "${title}" — You've Earned ₹${earningsAfterCommission.toFixed(2)}!`;

  const htmlContent = `
  <div style="font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 20px; text-align: center;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  
      <!-- Header Section -->
      <div style="background: #fe424d; padding: 30px; color: #fff; text-align: center;">
        <h1 style="font-size: 28px; font-weight: bold; margin: 0;">WanderHeavn</h1>
        <p style="font-size: 18px; margin-top: 8px;">Your Booking Confirmation</p>
      </div>
  
      <!-- Body Section -->
      <div style="padding: 40px; color: #444; line-height: 1.6;">
        <h2 style="color: #fe424d; font-size: 24px; margin-bottom: 20px;">You have a new booking!</h2>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          Hello Host, <br><br>
          Great news! Your property <strong style="color: #fe424d;">"${title}"</strong> in <strong>${location}</strong> has been booked by <strong>${guestName}</strong>.<br>
          You've earned <strong style="color: green;">₹${earningsAfterCommission.toFixed(2)}</strong> from this booking .
        </p>
  
        <!-- Support Section -->
        <div style="margin-top: 30px; font-size: 16px; color: #777;">
          <p>If you need assistance, feel free to <a href="mailto:support@wanderheavn.com" style="color: #fe424d; text-decoration: none; font-weight: bold;">Contact WanderHeavn Support</a> anytime.</p>
        </div>
      </div>
  
      <!-- Footer Section -->
      <div style="background: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd;">
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
    console.log(`Host earning email sent: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error(' Error sending host email:', error);
    throw error;
  }
};

module.exports = { sendHostEarningEmail };