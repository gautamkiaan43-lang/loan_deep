const mongoose = require('mongoose');

const loanReviewSchema = new mongoose.Schema({
  loanApplicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanApplication',
    required: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerRole: {
    type: String,
    enum: ['admin', 'staff'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  notes: {
    type: String
  },
  recommendation: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('LoanReview', loanReviewSchema);
