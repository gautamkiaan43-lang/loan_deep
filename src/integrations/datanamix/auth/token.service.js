/**
 * Datanamix Token Management Service
 * Oversees token caching (in-memory & optional DB fallback), lifetime tracking, and proactive renewal.
 */

const { fetchNewAccessToken } = require('./oauth.service');
const oauthConfig = require('../../../config/oauth.config');

// In-memory token cache store
let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Checks if the cached token is valid and not within the expiry buffer window
 * @returns {Boolean} True if the token is valid, false otherwise
 */
const isTokenValid = () => {
  if (!cachedToken || !tokenExpiresAt) return false;
  
  // Calculate remaining lifetime in seconds
  const remainingTimeSeconds = (tokenExpiresAt - Date.now()) / 1000;
  
  // Return false if token is expired or within the safety buffer zone (e.g. 5 minutes before actual expiry)
  return remainingTimeSeconds > oauthConfig.expiryBufferSeconds;
};

/**
 * Retrieves a valid Datanamix Bearer access token
 * Utilizes caching and automatically refreshes expired or near-expired tokens.
 * @returns {Promise<String>} The Bearer access token
 */
const getAccessToken = async () => {
  console.log('🎫 [Datanamix Token Manager]: Retrieving active access token...');

  // Return cached token if valid to avoid redundant network hops
  if (isTokenValid()) {
    console.log('⚡ [Datanamix Token Manager]: Utilizing cached access token.');
    return cachedToken;
  }

  try {
    console.log('🔄 [Datanamix Token Manager]: Token expired or empty. Fetching fresh credentials...');
    
    const tokenResponse = await fetchNewAccessToken();
    
    // Cache token and set absolute expiration timestamp
    cachedToken = tokenResponse.access_token;
    
    const durationMs = (tokenResponse.expires_in || 3600) * 1000;
    tokenExpiresAt = Date.now() + durationMs;
    
    console.log(`✅ [Datanamix Token Manager]: Fresh access token acquired. Expires in: ${tokenResponse.expires_in} seconds.`);
    return cachedToken;
  } catch (error) {
    console.error('❌ [Datanamix Token Manager]: Error securing access token:', error.message);
    throw error;
  }
};

/**
 * Force resets the cached token, prompting a new network fetch on next use
 */
const clearTokenCache = () => {
  console.log('🗑️ [Datanamix Token Manager]: Clearing access token cache.');
  cachedToken = null;
  tokenExpiresAt = null;
};

module.exports = {
  getAccessToken,
  clearTokenCache,
  isTokenValid
};
