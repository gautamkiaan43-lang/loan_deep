const axios = require('axios');

// ─── In-memory token state ───────────────────────────────────────────────────
let accessToken = null;
let tokenExpiry = null;
let lastExpiresIn = 14399;
let isRefreshing = false;

const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── isTokenExpired ───────────────────────────────────────────────────────────
const isTokenExpired = () => {
  if (!accessToken || !tokenExpiry) return true;
  return Date.now() >= tokenExpiry;
};

// ─── loginToDatanamix (OAuth2 Client Credentials) ────────────────────────────
const loginToDatanamix = async () => {
  const clientId = process.env.DATANAMIX_CLIENT_ID;
  const clientSecret = process.env.DATANAMIX_CLIENT_SECRET;
  const baseUrl = (process.env.DATANAMIX_BASE_URL || 'https://api.datanamix.com').replace(/\/$/, '');

  if (!clientId || !clientSecret) {
    throw new Error(
      'DATANAMIX_CLIENT_ID and DATANAMIX_CLIENT_SECRET must be set in .env'
    );
  }

  const tokenUrl = `${baseUrl}/v1/oauth/token`;

  const response = await axios.post(
    tokenUrl,
    {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    },
    {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15000,
    }
  );

  const { access_token, expires_in = 14399 } = response.data;

  if (!access_token) {
    throw new Error('Datanamix OAuth response did not contain an access_token');
  }

  return { access_token, expires_in };
};

// ─── refreshToken ─────────────────────────────────────────────────────────────
const refreshToken = async () => {
  isRefreshing = true;
  try {
    const { access_token, expires_in } = await loginToDatanamix();
    accessToken = access_token;
    lastExpiresIn = expires_in;
    // Refresh 60 seconds before actual expiry
    tokenExpiry = Date.now() + (expires_in - 60) * 1000;
    isRefreshing = false;
    return accessToken;
  } catch (error) {
    isRefreshing = false;
    throw error;
  }
};

// ─── getAccessToken ───────────────────────────────────────────────────────────
const getAccessToken = async () => {
  if (accessToken && !isTokenExpired()) {
    return accessToken;
  }
  return refreshToken();
};

// ─── initializeDatanamixAuth ──────────────────────────────────────────────────
const initializeDatanamixAuth = async () => {
  let attempts = 0;

  while (attempts < RETRY_COUNT) {
    try {
      console.log(`[Datanamix] Authentication attempt ${attempts + 1}/${RETRY_COUNT}...`);
      await refreshToken();
      console.log('[Datanamix] Authentication successful');
      console.log('[Datanamix] OAuth token initialized');
      console.log(`[Datanamix] Token expires in ${lastExpiresIn} seconds`);
      console.log('[Datanamix] Auto-refresh enabled');
      return;
    } catch (error) {
      attempts++;
      console.error(`[Datanamix] OAuth authentication failed: ${error.message}`);

      if (attempts < RETRY_COUNT) {
        console.log(`[Datanamix] Retrying authentication in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.error(
    '[Datanamix] Authentication failed after all retries. APIs will auto-retry on first call.'
  );
};

module.exports = {
  loginToDatanamix,
  getAccessToken,
  refreshToken,
  isTokenExpired,
  initializeDatanamixAuth,
};
