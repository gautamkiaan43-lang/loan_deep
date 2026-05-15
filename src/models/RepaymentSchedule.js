const mongoose = require('mongoose');

const repaymentScheduleSchema = new mongoose.Schema({
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ActiveLoan',
    required: true
  },
  borrowerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Borrower',
    required: true
  },
  emiNumber: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Partial', 'Overdue', 'Late Paid', 'Disputed'],
    default: 'Pending'
  },
  paidAt: {
    type: Date,
    default: null
  },
  lateDays: {
    type: Number,
    default: 0
  },
  penaltyAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
repaymentScheduleSchema.index({ loanId: 1, emiNumber: 1 }, { unique: true });
repaymentScheduleSchema.index({ borrowerId: 1 });
repaymentScheduleSchema.index({ dueDate: 1 });
repaymentScheduleSchema.index({ status: 1 });

module.exports = mongoose.model('RepaymentSchedule', repaymentScheduleSchema);
