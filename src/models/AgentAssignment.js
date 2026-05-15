const mongoose = require('mongoose');

const agentAssignmentSchema = new mongoose.Schema({
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
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Agent', 
    required: true 
  },
  assignedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignedAt: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Completed', 'Revoked'], 
    default: 'Active' 
  },
  notes: { 
    type: String 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AgentAssignment', agentAssignmentSchema);
