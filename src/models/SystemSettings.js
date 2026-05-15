const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  // Interest settings
  defaultInterestRate: { type: Number, default: 12.5 },
  minInterestRate: { type: Number, default: 8.0 },
  maxInterestRate: { type: Number, default: 25.0 },
  interestType: { type: String, enum: ['Reducing Balance', 'Flat Rate'], default: 'Reducing Balance' },

  // Processing fee
  processingFeeType: { type: String, enum: ['Fixed Amount', 'Percentage'], default: 'Fixed Amount' },
  processingFeeValue: { type: Number, default: 250 },
  autoApplyProcessingFee: { type: Boolean, default: true },

  // Repayment Governance
  gracePeriodDays: { type: Number, default: 3 },
  lateFeeAmount: { type: Number, default: 150 },
  allowGracePeriod: { type: Boolean, default: true },
  autoApplyLateFee: { type: Boolean, default: true },
  graceReminders: { type: Boolean, default: true },

  // Loan Configuration
  minimumLoanAmount: { type: Number, default: 1000 },
  maximumLoanAmount: { type: Number, default: 100000 },

  // Eligibility Settings
  minimumAge: { type: Number, default: 18 },
  minimumMonthlyIncome: { type: Number, default: 5000 },
  employmentType: { type: String, enum: ['Employed', 'Self Employed', 'Both'], default: 'Both' },
  eligibleMinimumPrincipal: { type: Number, default: 1000 },
  eligibleMaximumPrincipal: { type: Number, default: 50000 },
  allowedRepaymentDurations: { type: String, default: '3, 6, 12, 18, 24' }, // In months

  // Document verification rules
  idVerificationRequired: { type: Boolean, default: true },
  bankStatementReview: { type: Boolean, default: true },
  payslipVerification: { type: Boolean, default: true },
  proofOfAddressAudit: { type: Boolean, default: true },
  manualStaffDecision: { type: Boolean, default: true },
  creditBureauIntegration: { type: Boolean, default: false },

  // Validation
  enableAutoApprovalLogic: { type: Boolean, default: false },
  enableEligibilityEngine: { type: Boolean, default: true },
  enableAutoAssignment: { type: Boolean, default: true }
}, { timestamps: true });


module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
