/**
 * Unified Datanamix API Client Wrapper
 * Integrates token management, base request options, headers, and error catching.
 */

const { getAccessToken } = require('../auth/token.service');
const { executeRequest } = require('./requestHandler');
const datanamixConfig = require('../../../config/datanamix.config');

/**
 * Standardized client method for communicating with verified Datanamix endpoints
 * @param {Object} requestOptions - Sub-request configurations (endpoint, method, payload, headers)
 * @returns {Promise<Object>} The resolved API response
 */
const datanamixClient = async (requestOptions = {}) => {
  const { endpoint, method = 'POST', data = null, params = null, headers = {} } = requestOptions;

  try {
    // 1. Fetch valid access token from cache or auth server
    const token = await getAccessToken();

    // 2. Build full request headers
    const requestHeaders = {
      'Authorization': `Bearer ${token}`,
      ...headers
    };

    // 3. Fire the request using request handler
    const response = await executeRequest({
      url: endpoint,
      method,
      data,
      params,
      headers: requestHeaders
    });

    return response;
  } catch (error) {
    console.error(`❌ [Datanamix Client Request Failure] URL: ${endpoint} | Error:`, error.message);
    throw error;
  }
};

module.exports = {
  datanamixClient
};
