/**
 * Centralized sandbox bypass helper.
 * Returns true when DEV_ONLY_BYPASS_SEQUENTIAL_GATING=true.
 */
const isDevelopmentSandboxBypassEnabled = () =>
  process.env.DEV_ONLY_BYPASS_SEQUENTIAL_GATING === 'true';

/**
 * Centralized next step bypass helper.
 * Returns true when DEV_ONLY_BYPASS_NEXT_STEP=true.
 */
const isDevelopmentNextStepBypassEnabled = () =>
  process.env.DEV_ONLY_BYPASS_NEXT_STEP === 'true';

module.exports = { 
  isDevelopmentSandboxBypassEnabled,
  isDevelopmentNextStepBypassEnabled 
};
