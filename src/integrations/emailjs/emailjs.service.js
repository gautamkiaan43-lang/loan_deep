const config = require('./emailjs.config');
const { buildOtpEmailPayload } = require('./otpEmail.template');

/**
 * Sends OTP Email using the EmailJS HTTP REST API
 * @param {string} toEmail - Borrower's email address
 * @param {string} userName - Borrower's full name
 * @param {string} otpCode - Generated 6-digit OTP code
 * @returns {Promise<boolean>} Resolves to true if the email is successfully sent
 */
const sendOtpEmail = async (toEmail, userName, otpCode, agreementNumber) => {
  if (!toEmail || typeof toEmail !== 'string' || !toEmail.includes('@')) {
    console.error(`[EmailJS] Email validation failed for recipient: "${toEmail}"`);
    throw new Error('Invalid email address format.');
  }

  const templateParams = buildOtpEmailPayload(toEmail, userName, otpCode, agreementNumber);

  const payload = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    accessToken: config.privateKey,
    template_params: templateParams,
  };

  try {
    console.log(`[EmailJS] Generating OTP signature request...`);
    console.log(`[EmailJS] Dispatching OTP email via REST API to: ${toEmail}`);
    
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[EmailJS] Email delivery failure. HTTP ${response.status}: ${responseText}`);
      if (response.status === 403) {
        throw new Error('EmailJS API Forbidden (403): Secure Private Key/Access Token or Public Key is incorrect.');
      }
      throw new Error(`EmailJS delivery failed with status ${response.status}: ${responseText}`);
    }

    console.log(`[EmailJS] OTP email successfully sent to ${toEmail}. Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`[EmailJS] Critical send error for ${toEmail}:`, error.message);
    throw error;
  }
};

module.exports = {
  sendOtpEmail,
};
