const axios = require('axios');

/**
 * Sends an OTP SMS using the BulkSMS API
 * 
 * @param {string} phoneNumber - The recipient's phone number (e.g., in international format like +27...)
 * @param {string} otpCode - The 6-digit OTP code to send
 * @param {string} agreementNumber - Optional agreement number for context
 * @returns {Promise<Object>} API response data
 */
const sendOtpSms = async (phoneNumber, otpCode, agreementNumber) => {
  try {
    const apiUrl = process.env.SMS_API_URL || 'https://api.bulksms.com/v1/messages';
    const authToken = process.env.SMS_AUTH_TOKEN;

    if (!authToken) {
      console.warn('[BulkSMS] SMS_AUTH_TOKEN is missing. SMS dispatch skipped.');
      return { success: false, message: 'SMS Auth token not configured' };
    }

    // Format phone number to international format if needed (e.g., South Africa)
    // Assuming standard format, but just a safety check
    let formattedPhone = phoneNumber.replace(/\\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+27' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    const messageText = `Your Point.47 digital agreement ${agreementNumber ? `(${agreementNumber}) ` : ''}OTP is: ${otpCode}. It is valid for ${process.env.OTP_EXPIRY_MINUTES || 5} minutes. Do not share this code with anyone.`;

    const payload = {
      to: formattedPhone,
      body: messageText
    };

    console.log(`[BulkSMS] Dispatching SMS OTP to: ${formattedPhone}`);

    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[BulkSMS] SMS successfully sent to ${formattedPhone}. Status: ${response.status}`);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`[BulkSMS] Failed to send SMS to ${phoneNumber}:`, errorDetails);
    throw new Error(`SMS dispatch failed: ${error.message}`);
  }
};

module.exports = {
  sendOtpSms
};
