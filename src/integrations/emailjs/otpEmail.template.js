/**
 * EmailJS OTP Email Template Meta-Definition
 * 
 * Template Variables expected by template (template_o1f8s91):
 * - user_name: The name of the borrower signing the agreement
 * - otp_code: The 6-digit one-time passcode for signing
 * - to_email: The borrower's destination email address
 */
const buildOtpEmailPayload = (toEmail, userName, otpCode, agreementNumber) => {
  return {
    user_name: userName,
    otp_code: otpCode,
    to_email: toEmail,
    agreement_number: agreementNumber,
  };
};

module.exports = {
  buildOtpEmailPayload,
};
