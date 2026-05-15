const SystemSettings = require('../../models/SystemSettings');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/responseHandler');

// Utility to get or seed default settings
const getOrInitSettings = async () => {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({}); // Creates with schema defaults
  }
  return settings;
};

/**
 * @desc    Get current system settings
 * @route   GET /api/admin/settings
 * @access  Private/Admin
 */
const getSettings = asyncHandler(async (req, res) => {
  const settings = await getOrInitSettings();
  sendSuccess(res, 'System settings fetched', settings);
});

/**
 * @desc    Update general settings
 * @route   PUT /api/admin/settings/general
 * @access  Private/Admin
 */
const updateGeneralSettings = asyncHandler(async (req, res) => {
  const {
    defaultInterestRate,
    minInterestRate,
    maxInterestRate,
    interestType,
    processingFeeType,
    processingFeeValue,
    autoApplyProcessingFee,
    gracePeriodDays,
    lateFeeAmount,
    allowGracePeriod,
    autoApplyLateFee,
    graceReminders,
    minimumLoanAmount,
    maximumLoanAmount
  } = req.body;

  let settings = await getOrInitSettings();

  settings.defaultInterestRate = defaultInterestRate;
  settings.minInterestRate = minInterestRate;
  settings.maxInterestRate = maxInterestRate;
  settings.interestType = interestType;
  settings.processingFeeType = processingFeeType;
  settings.processingFeeValue = processingFeeValue;
  settings.autoApplyProcessingFee = autoApplyProcessingFee;
  settings.gracePeriodDays = gracePeriodDays;
  settings.lateFeeAmount = lateFeeAmount;
  settings.allowGracePeriod = allowGracePeriod;
  settings.autoApplyLateFee = autoApplyLateFee;
  settings.graceReminders = graceReminders;
  settings.minimumLoanAmount = minimumLoanAmount;
  settings.maximumLoanAmount = maximumLoanAmount;

  await settings.save();
  sendSuccess(res, 'General settings updated successfully', settings);
});

/**
 * @desc    Update eligibility rules
 * @route   PUT /api/admin/settings/eligibility
 * @access  Private/Admin
 */
const updateEligibilityRules = asyncHandler(async (req, res) => {
  const {
    minimumAge,
    minimumMonthlyIncome,
    employmentType,
    eligibleMinimumPrincipal,
    eligibleMaximumPrincipal,
    allowedRepaymentDurations
  } = req.body;

  let settings = await getOrInitSettings();

  settings.minimumAge = minimumAge;
  settings.minimumMonthlyIncome = minimumMonthlyIncome;
  settings.employmentType = employmentType;
  settings.eligibleMinimumPrincipal = eligibleMinimumPrincipal;
  settings.eligibleMaximumPrincipal = eligibleMaximumPrincipal;
  settings.allowedRepaymentDurations = allowedRepaymentDurations;

  await settings.save();
  sendSuccess(res, 'Eligibility rules updated successfully', settings);
});

/**
 * @desc    Update documentation and verification rules
 * @route   PUT /api/admin/settings/document-rules
 * @access  Private/Admin
 */
const updateDocumentRules = asyncHandler(async (req, res) => {
  const {
    idVerificationRequired,
    bankStatementReview,
    payslipVerification,
    proofOfAddressAudit,
    manualStaffDecision,
    creditBureauIntegration,
    enableAutoApprovalLogic
  } = req.body;

  let settings = await getOrInitSettings();

  settings.idVerificationRequired = idVerificationRequired;
  settings.bankStatementReview = bankStatementReview;
  settings.payslipVerification = payslipVerification;
  settings.proofOfAddressAudit = proofOfAddressAudit;
  settings.manualStaffDecision = manualStaffDecision;
  settings.creditBureauIntegration = creditBureauIntegration;
  settings.enableAutoApprovalLogic = enableAutoApprovalLogic;

  await settings.save();
  sendSuccess(res, 'Verification rules updated successfully', settings);
});

/**
 * @desc    Reset settings to system defaults
 * @route   POST /api/admin/settings/reset
 * @access  Private/Admin
 */
const resetSettings = asyncHandler(async (req, res) => {
  await SystemSettings.deleteMany({});
  const freshSettings = await SystemSettings.create({}); // seed default blank object, will auto-populate via defaults
  sendSuccess(res, 'System settings reset to default successfully', freshSettings);
});

/**
 * @desc    Calculate live logic preview without saving
 * @route   POST /api/admin/settings/live-preview
 * @access  Private/Admin
 */
const calculateLivePreview = asyncHandler(async (req, res) => {
  const temp = req.body; // Contains unsaved client settings
  
  // Calculate mock Monthly Repayment based on principal = 10000 over 12 months
  const P = 10000;
  const N = 12;
  const rate = Number(temp.defaultInterestRate || 12.5);
  
  let monthlyRepayment = 0;
  
  if (temp.interestType === 'Flat Rate') {
    const totalInterest = P * (rate / 100);
    monthlyRepayment = (P + totalInterest) / N;
  } else {
    // Reducing Balance / Standard Compound EMI
    const monthlyRate = (rate / 100) / 12;
    if (monthlyRate === 0) {
      monthlyRepayment = P / N;
    } else {
      monthlyRepayment = (P * monthlyRate * Math.pow(1 + monthlyRate, N)) / (Math.pow(1 + monthlyRate, N) - 1);
    }
  }

  // Formulate localized strings or numbers
  const response = {
    monthlyRepayment: Math.round(monthlyRepayment),
    minPrincipal: temp.eligibleMinimumPrincipal || 1000,
    maxPrincipal: temp.eligibleMaximumPrincipal || 50000,
    baseInterest: `${rate}%`,
    processingFee: temp.processingFeeType === 'Percentage' 
      ? `${temp.processingFeeValue || 0}%` 
      : `R ${temp.processingFeeValue || 0}`,
    penaltyGrace: `${temp.gracePeriodDays || 0} Days`,
    logicSummary: {
      interestBasis: temp.interestType || 'Reducing Balance',
      feeFrequency: 'Once per approved loan',
      penaltyBasis: temp.autoApplyLateFee ? 'Automated Overdue Run' : 'Manual Verification Trigger',
      reviewFlow: temp.enableAutoApprovalLogic ? 'Instant Automated Desk' : 'Manual Verification Gate'
    }
  };

  sendSuccess(res, 'Live preview calculated', response);
});

module.exports = {
  getSettings,
  updateGeneralSettings,
  updateEligibilityRules,
  updateDocumentRules,
  resetSettings,
  calculateLivePreview
};
