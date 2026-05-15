const mongoose = require('mongoose');

const followUpLogSchema = new mongoose.Schema({
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActiveLoan', required: true },
  borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Borrower', required: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  followUpType: { 
    type: String, 
    enum: ['CHAT', 'VISIT'], 
    required: true 
  },
  recoveryStatus: { 
    type: String, 
    enum: ['NORMAL', 'PROMISED', 'WARNING', 'CRITICAL'], 
    default: 'NORMAL' 
  },
  
  nextFollowUpDate: { type: Date },
  notes: { type: String },
  
  // Visit specific fields
  visitDate: { type: Date },
  visitLocation: { type: String },
  
  // Chat specific reference
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, {
  timestamps: true
});

module.exports = mongoose.model('FollowUpLog', followUpLogSchema);
