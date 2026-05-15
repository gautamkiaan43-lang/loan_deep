const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  commissionCode: {
    type: String,
    unique: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  borrowerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Borrower',
    required: true
  },
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ActiveLoan',
    required: true
  },
  loanAmount: {
    type: Number,
    required: true
  },
  commissionPercent: {
    type: Number,
    default: 2.5
  },
  commissionAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Paid'],
    default: 'Pending'
  },
  payoutDate: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Pre-save to auto-generate commissionCode
commissionSchema.pre('save', async function() {
  if (this.isNew && !this.commissionCode) {
    try {
      const lastComm = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
      let nextNum = 1;
      if (lastComm && lastComm.commissionCode) {
        const parts = lastComm.commissionCode.split('-');
        if (parts.length === 2 && !isNaN(parts[1])) {
          nextNum = parseInt(parts[1], 10) + 1;
        }
      }
      this.commissionCode = `COM-${nextNum.toString().padStart(4, '0')}`;
    } catch (err) {
      throw err;
    }
  }
});

module.exports = mongoose.model('Commission', commissionSchema);
