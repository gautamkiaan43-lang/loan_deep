const mongoose = require('mongoose');

const loanActivitySchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Payment', 'Penalty', 'System', 'StatusChange', 'Notification'],
    default: 'System'
  }
}, {
  timestamps: true
});

// Index for faster queries
loanActivitySchema.index({ loanId: 1, createdAt: -1 });
loanActivitySchema.index({ borrowerId: 1, createdAt: -1 });

module.exports = mongoose.model('LoanActivity', loanActivitySchema);
