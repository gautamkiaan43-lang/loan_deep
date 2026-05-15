const FollowUpLog = require('../../models/FollowUpLog');
const ActiveLoan = require('../../models/ActiveLoan');
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const Notification = require('../../models/Notification');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const { getIO } = require('../../socket/socketServer');

/**
 * @desc    Create a new follow-up log (Chat or Visit)
 * @route   POST /api/agent/follow-ups
 * @access  Private/Agent
 */
const createFollowUp = asyncHandler(async (req, res) => {
  const { 
    loanId, 
    followUpType, 
    recoveryStatus, 
    nextFollowUpDate, 
    notes, 
    visitDate, 
    visitLocation 
  } = req.body;
  const agentId = req.user._id;

  // 1. Validate Loan & Assignment
  const loan = await ActiveLoan.findOne({ _id: loanId, assignedAgent: agentId });
  if (!loan) {
    return sendError(res, 'Loan not found or not assigned to you', 404);
  }

  // 2. Handle CHAT integration
  let messageId = null;
  if (followUpType === 'CHAT') {
    // Find conversation between agent and borrower
    let conversation = await Conversation.findOne({
      participants: { $all: [agentId, loan.borrowerId] },
      conversationType: 'Agent'
    });

    // Create if not exists (fallback)
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [agentId, loan.borrowerId, loan.approvedBy || req.user._id],
        participantRoles: ['agent', 'borrower', 'admin'],
        conversationType: 'Agent',
        createdBy: agentId
      });
    }

    // Save message
    const newMessage = await Message.create({
      conversationId: conversation._id,
      senderId: agentId,
      senderRole: 'agent',
      message: notes,
      messageType: 'reminder'
    });
    
    messageId = newMessage._id;

    // Update conversation last message
    conversation.lastMessage = notes;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Emit Socket event for real-time chat
    const io = getIO();
    if (io) {
      io.to(conversation._id.toString()).emit('new-followup-message', {
        message: newMessage,
        conversationId: conversation._id
      });
    }
  }

  // 3. Create Follow-Up Log
  const log = await FollowUpLog.create({
    loanId,
    borrowerId: loan.borrowerId,
    agentId,
    followUpType,
    recoveryStatus,
    nextFollowUpDate,
    notes,
    visitDate,
    visitLocation,
    messageId
  });

  // 4. Update Active Loan Status
  loan.followUpStatus = recoveryStatus === 'NORMAL' ? 'Resolved' : 'Follow-Up';
  loan.nextFollowUpDate = nextFollowUpDate;
  
  // Map recoveryStatus to recoveryPriority
  if (recoveryStatus === 'CRITICAL') loan.recoveryPriority = 'High';
  else if (recoveryStatus === 'WARNING') loan.recoveryPriority = 'Medium';
  else loan.recoveryPriority = 'Low';
  
  await loan.save();

  // 5. Notifications & Alerts
  const io = getIO();
  
  // Standard notification
  await Notification.create({
    receiverId: agentId,
    receiverRole: 'agent',
    title: 'Follow-up Logged',
    message: `Follow-up for ${loan.borrowerName} saved as ${recoveryStatus}.`,
    notificationType: 'FOLLOWUP_UPDATE'
  });

  if (io) {
    io.to(agentId.toString()).emit('followup-updated', { loanId, recoveryStatus });
  }

  // Admin Escalation for Warning/Critical
  if (recoveryStatus === 'WARNING' || recoveryStatus === 'CRITICAL') {
    const priority = recoveryStatus === 'CRITICAL' ? 'Urgent' : 'Important';
    
    // Notify Admins
    await Notification.create({
      receiverId: loan.assignedBy || loan.approvedBy, // Notify assigner/approver
      receiverRole: 'admin',
      title: `${recoveryStatus} Recovery Alert`,
      message: `${priority} recovery alert for ${loan.borrowerName} (${loan.loanCode}). Status: ${recoveryStatus}`,
      notificationType: 'RECOVERY_ALERT',
      priority: priority,
      relatedId: loan._id
    });

    if (io) {
      io.emit(recoveryStatus === 'CRITICAL' ? 'critical-recovery-alert' : 'recovery-warning', {
        loanCode: loan.loanCode,
        borrowerName: loan.borrowerName,
        status: recoveryStatus
      });
    }
  }

  sendSuccess(res, 'Follow-up processed successfully', { log, loan });
});

/**
 * @desc    Get follow-up history for a loan
 * @route   GET /api/agent/follow-ups/:loanId
 */
const getFollowUpHistory = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const agentId = req.user._id;

  const logs = await FollowUpLog.find({ loanId, agentId })
    .sort({ createdAt: -1 })
    .populate('messageId');

  sendSuccess(res, 'Follow-up history retrieved', logs);
});

module.exports = {
  createFollowUp,
  getFollowUpHistory
};
