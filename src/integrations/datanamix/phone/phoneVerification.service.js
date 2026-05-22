/**
 * Phone Verification Service
 * Handles: CARRIER IDENTITY
 * Cross-checks phone number ownership, carrier assignment, active status, and matching identity tags.
 */

const { datanamixClient } = require('../shared/datanamixClient');
const datanamixConfig = require('../../../config/datanamix.config');

/**
 * Verifies carrier registration status and customer matching tags
 * @param {Object} phoneData - Details (phoneNumber, idNumber, fullName)
 * @returns {Promise<Object>} Verification results or status placeholders
 */
const verifyPhoneOwnership = async (phoneData = {}) => {
  const { phoneNumber, idNumber, fullName } = phoneData;

  console.log(`📱 [Datanamix Service]: Triggering Carrier Identity checks for Phone: ${phoneNumber || 'N/A'}`);

  const payload = {
    phoneNumber,
    idNumber,
    fullName
  };

  try {
    // TODO: Connect to Datanamix phone verification endpoint once credentials are active
    const response = await datanamixClient({
      endpoint: datanamixConfig.endpoints.phoneVerification,
      method: 'POST',
      data: payload
    });

    console.log(`📝 [Datanamix Phone Verification TODO]: Map SIM swap date, ownership, and network carrier status.`);

    return {
      verified: false,
      verificationStatus: 'FOUNDATION_READY',
      phoneNumber,
      networkCarrier: null,        // e.g., Vodacom, MTN, Cell C
      simSwapDetected: null,
      identityMatchResult: {
        idNumberMatched: null,     // Match indicator
        fullNameMatched: null      // Match indicator
      },
      audit: response
    };
  } catch (error) {
    console.error('❌ [Datanamix Phone Service Error]:', error.message);
    throw error;
  }
};

module.exports = {
  verifyPhoneOwnership
};
