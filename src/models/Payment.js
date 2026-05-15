const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Borrower', required: true },
  borrowerName: { type: String, required: true },
  borrowerPhoto: { type: String },
  borrowerPhone: { type: String },

  loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActiveLoan', required: true },
  loanCode: { type: String, required: true },

  transactionId: { type: String, required: true, unique: true },

  paymentAmount: { type: Number, required: true },
  paymentDate: { type: Date, required: true },

  paymentMethod: { 
    type: String, 
    enum: ['Bank Transfer', 'EFT', 'Cash Deposit', 'Mobile Payment', 'Debit Order'],
    required: true
  },

  receiptImage: { type: String },
  receiptFile: { type: String },

  paymentStatus: { 
    type: String, 
    enum: ['Pending', 'Verified', 'Rejected'], 
    default: 'Pending' 
  },

  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedDate: { type: Date },

  rejectionReason: { type: String },
  notes: { type: String },

  paymentType: { 
    type: String, 
    enum: ['EMI Payment', 'Penalty Payment', 'Full Settlement'],
    default: 'EMI Payment'
  },

  overduePenaltyIncluded: { type: Boolean, default: false },
  remainingBalanceAfterPayment: { type: Number },

  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

paymentSchema.pre('validate', async function() {
  if (this.isNew && !this.transactionId) {
    try {
      const lastPayment = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
      let nextNum = 1;
      if (lastPayment && lastPayment.transactionId) {
        const parts = lastPayment.transactionId.split('-');
        if (parts.length === 2 && !isNaN(parts[1])) {
          nextNum = parseInt(parts[1], 10) + 1;
        }
      }
      this.transactionId = `TRX-${nextNum.toString().padStart(4, '0')}`;
    } catch (err) {
      throw err;
    }
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
