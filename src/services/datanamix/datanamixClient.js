const axios = require('axios');
const { getAccessToken, refreshToken } = require('./datanamixAuth.service');

const BASE_URL = (process.env.DATANAMIX_BASE_URL || 'https://api.datanamix.com').replace(/\/$/, '');

// ─── Axios instance ───────────────────────────────────────────────────────────
const datanamixAxiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request interceptor — inject Bearer token automatically ─────────────────
datanamixAxiosClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    config.headers['Authorization'] = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — handle 401/403/TOKEN_EXPIRED with auto-retry ─────
datanamixAxiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const status = error.response?.status;
    const errorCode =
      error.response?.data?.error_code ||
      error.response?.data?.code ||
      error.response?.data?.error;

    const isAuthError =
      status === 401 ||
      status === 403 ||
      errorCode === 'TOKEN_EXPIRED' ||
      errorCode === 'UNAUTHORIZED';

    if (isAuthError && !originalRequest._retried) {
      originalRequest._retried = true;

      try {
        console.log(
          '[Datanamix Client] Auth error detected — refreshing token and retrying request...'
        );
        const newToken = await refreshToken();
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return datanamixAxiosClient(originalRequest);
      } catch (refreshError) {
        console.error(
          '[Datanamix Client] Token refresh failed during retry:',
          refreshError.message
        );
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

module.exports = datanamixAxiosClient;
