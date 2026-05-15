const mongoose = require('mongoose');

const repaymentScheduleSchema = new mongoose.Schema({
  installmentNumber: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  emiAmount: { type: Number, required: true },
  principalAmount: { type: Number, required: true },
  interestAmount: { type: Number, required: true },
  paymentStatus: { 
    type: String, 
    enum: ['Pending', 'Paid', 'Overdue'], 
    default: 'Pending' 
  },
  paidDate: { type: Date },
  lateFee: { type: Number, default: 0 }
});

const activeLoanSchema = new mongoose.Schema({
  borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Borrower', required: true },
  borrowerName: { type: String, required: true },
  borrowerPhoto: { type: String },
  borrowerEmail: { type: String },
  borrowerPhone: { type: String },
  
  loanApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
  loanCode: { type: String, required: true, unique: true },
  
  loanType: { type: String },
  approvedAmount: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  loanDurationMonths: { type: Number, required: true },
  
  emiAmount: { type: Number, required: true },
  totalPayableAmount: { type: Number, required: true },
  remainingBalance: { type: Number, required: true },
  
  nextDueDate: { type: Date },
  
  repaymentSchedule: [repaymentScheduleSchema],
  
  overdueDays: { type: Number, default: 0 },
  penaltyAmount: { type: Number, default: 0 },
  
  loanStatus: { 
    type: String, 
    enum: ['Active', 'Overdue', 'Completed', 'Closed'], 
    default: 'Active' 
  },
  overdueStatus: { 
    type: String, 
    enum: ['On Time', '1-7 Days Late', '8+ Days Late'], 
    default: 'On Time' 
  },
  
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedDate: { type: Date, default: Date.now },
  
  // Agent Assignment & Recovery Operations
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  followUpStatus: { 
    type: String, 
    enum: ["Pending", "Contacted", "Follow-Up", "Resolved"], 
    default: "Pending" 
  },
  nextFollowUpDate: { type: Date },
  recoveryPriority: { 
    type: String, 
    enum: ["Low", "Medium", "High"], 
    default: "Low" 
  },
  
  lastPaymentDate: { type: Date },
  
  notes: { type: String },
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Pre-save to auto-generate loanCode if not exists
activeLoanSchema.pre('validate', async function() {
  if (this.isNew && !this.loanCode) {
    try {
      const lastLoan = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
      let nextNum = 1;
      if (lastLoan && lastLoan.loanCode) {
        const parts = lastLoan.loanCode.split('-');
        if (parts.length === 2 && !isNaN(parts[1])) {
          nextNum = parseInt(parts[1], 10) + 1;
        }
      }
      this.loanCode = `P47-${nextNum.toString().padStart(3, '0')}`;
    } catch (err) {
      throw err;
    }
  }
});

module.exports = mongoose.model('ActiveLoan', activeLoanSchema);
