const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      unique: true,
      required: true,
    },
    borrowerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Personal Info (Captured in Step 1)
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    emailAddress: { type: String, required: true },
    idNumber: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    residentialAddress: { type: String, required: true },

    // Financial Totals (Calculated from Banking/Admin Settings)
    requestedAmount: { type: Number },
    requestedDuration: { type: Number }, // In months
    loanType: { type: String, default: 'Personal Loan' },
    processingFee: { type: Number },
    interestRate: { type: Number },
    estimatedMonthlyEMI: { type: Number },
    totalRepayment: { type: Number },

    // Status Tracking
    status: {
      type: String,
      enum: ['Draft', 'New', 'Submitted', 'Pending Review', 'Under Review', 'Reviewed', 'Recommended', 'Pending Verification', 'Approved', 'Rejected', 'Disbursed', 'Hold'],
      default: 'Draft',
    },
    
    // Submission flags
    confirmationAccepted: { type: Boolean, default: false },
    submittedAt: { type: Date },

    // Credit-risk API readiness fields (populated at submission, used by future bureau integrations)
    creditConsentAccepted: { type: Boolean, default: false },
    creditConsentAcceptedAt: { type: Date },
    documentVerificationStatus: {
      type: String,
      enum: ['Pending', 'Complete', 'Incomplete'],
      default: 'Pending',
    },
    creditRiskReady: { type: Boolean, default: false },
    applicationAuditStatus: {
      type: String,
      enum: ['Ready For Review', 'Missing Documents', 'Awaiting Verification', 'Credit Consent Missing', 'Incomplete'],
      default: 'Incomplete',
    },
    
    reviewStatus: {
      type: String,
      enum: ['Pending', 'Under Review', 'Recommendation Submitted', 'Rejected Recommendation', 'Reviewed', 'Pending Review'],
      default: 'Pending'
    },

    uploadedDocsStatus: {
      type: String,
      enum: ['Pending', 'Complete', 'Incomplete'],
      default: 'Pending'
    },

    documentVerification: {
      idProofStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
      idProofNotes: String,
      payslipStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
      payslipNotes: String,
      bankStatementStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
      bankStatementNotes: String,
      proofOfAddressStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
      proofOfAddressNotes: String
    },

    staffReview: {
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      staffName: String,
      verificationNotes: String,
      recommendation: { type: String, enum: ['Pending', 'Recommended', 'Recommended for Approval', 'Recommended for Rejection', 'Recommend Approval', 'Recommend Rejection', 'Rejected', 'Put On Hold'], default: 'Pending' },
      riskLevel: { type: String, enum: ['Low', 'Medium', 'High', 'Critical', 'N/A'], default: 'N/A' },
      verificationDate: Date
    },

    adminDecision: {
      decision: { type: String, enum: ['Approved', 'Rejected', 'Hold', 'Pending'], default: 'Pending' },
      adminNotes: String,
      approvedAmount: Number,
      finalDuration: Number,
      interestOverride: Number,
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedDate: Date,
      rejectionReason: String,
      rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rejectedDate: Date,
      holdReason: String,
      holdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      holdDate: Date
    },

    statusHistory: [
      {
        status: String,
        changedBy: String,
        notes: String,
        changedAt: { type: Date, default: Date.now }
      }
    ],

    recommendationNotes: String,
    rejectionReason: String,
    internalReviewNotes: String,
    
    // Timeline/Milestones
    reviewedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    disbursedAt: { type: Date },

    // Communication
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },

    // Assignment Details
    assignedReviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date }
  },
  {
    timestamps: true,
  }
);

// Auto-generate Application ID before validation
loanApplicationSchema.pre('validate', async function () {
  if (this.isNew && !this.applicationId) {
    try {
      const lastApplication = await mongoose.model('LoanApplication').findOne({}, {}, { sort: { createdAt: -1 } });
      let nextId = 1001;
      if (lastApplication && lastApplication.applicationId) {
        const lastIdMatch = lastApplication.applicationId.match(/LAPP-(\d+)/);
        if (lastIdMatch) {
          nextId = parseInt(lastIdMatch[1]) + 1;
        }
      }
      this.applicationId = `LAPP-${nextId}`;
    } catch (err) {
      throw err;
    }
  }
});



module.exports = mongoose.model('LoanApplication', loanApplicationSchema);
