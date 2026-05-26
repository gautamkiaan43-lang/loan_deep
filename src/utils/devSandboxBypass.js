/**
 * DEV-ONLY sandbox bypass helper.
 * Returns true ONLY when NODE_ENV=development AND DEV_ONLY_BYPASS_SEQUENTIAL_GATING=true.
 * Always returns false in production — safe to call anywhere without environment guards.
 */
const isDevelopmentSandboxBypassEnabled = () =>
  process.env.NODE_ENV === 'development' &&
  process.env.DEV_ONLY_BYPASS_SEQUENTIAL_GATING === 'true';

/**
 * DEV-ONLY next step bypass helper.
 * Returns true ONLY when NODE_ENV=development AND DEV_ONLY_BYPASS_NEXT_STEP=true.
 * Always returns false in production.
 */
const isDevelopmentNextStepBypassEnabled = () =>
  process.env.NODE_ENV === 'development' &&
  process.env.DEV_ONLY_BYPASS_NEXT_STEP === 'true';

module.exports = { 
  isDevelopmentSandboxBypassEnabled,
  isDevelopmentNextStepBypassEnabled 
};
