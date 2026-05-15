const asyncHandler = require('express-async-handler');
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const User = require('../../models/User');
const Agent = require('../../models/Agent');
const Staff = require('../../models/Staff');
const LoanApplication = require('../../models/LoanApplication');
const { getIO } = require('../../socket/socketServer');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const { createNotification } = require('../../utils/notificationHelper');

/**
 * @desc    Get all conversations for agent with grouped potential participants
 * @route   GET /api/agent/communications
 * @access  Private/Agent
 */
const getConversations = asyncHandler(async (req, res) => {
  const { filter } = req.query; // 'borrower', 'staff', 'admin', 'all'
  const agentId = req.user._id;

  // 1. Get Agent Profile to know assigned borrowers
  const agentProfile = await Agent.findOne({ userId: agentId });
  const assignedBorrowerIds = agentProfile?.assignedBorrowers || [];

  // 2. Fetch "Proper" Participants based on Fintech Rules
  
  // A. Assigned Borrowers
  const assignedBorrowers = await User.find({ 
    _id: { $in: assignedBorrowerIds },
    role: 'borrower'
  }).select('_id fullName email role profilePhoto status isActive');

  // B. Related Staff (Staff assigned to the agent's borrowers' applications)
  const relatedApplications = await LoanApplication.find({
    borrowerId: { $in: assignedBorrowerIds }
  }).select('staffReview.reviewedBy');

  const relatedStaffIds = [...new Set(relatedApplications
    .map(app => app.staffReview?.reviewedBy)
    .filter(id => id != null)
  )];

  const relatedStaff = await User.find({
    _id: { $in: relatedStaffIds },
    role: 'staff'
  }).select('_id fullName email role profilePhoto status isActive');

  // C. Admin Support (Always visible for escalation)
  const adminSupport = await User.find({
    role: 'admin'
  }).select('_id fullName email role profilePhoto status isActive');

  // 3. Fetch existing conversations
  const conversations = await Conversation.find({
    participants: agentId
  })
  .populate('participants', 'fullName email role profilePhoto status isActive')
  .sort({ updatedAt: -1 });

  // 4. Merge into a unified list for the sidebar
  let potentialUsers = [];
  if (!filter || filter === 'all' || filter === 'All') {
    potentialUsers = [...assignedBorrowers, ...relatedStaff, ...adminSupport];
  } else if (filter === 'borrower' || filter === 'Borrower') {
    potentialUsers = assignedBorrowers;
  } else if (filter === 'staff' || filter === 'Staff') {
    potentialUsers = relatedStaff;
  } else if (filter === 'admin' || filter === 'Admin') {
    potentialUsers = adminSupport;
  }

  const existingConvMap = new Map();
  conversations.forEach(c => {
    const peer = c.participants.find(p => p._id.toString() !== agentId.toString());
    if (peer) {
      existingConvMap.set(peer._id.toString(), c);
    }
  });

  const unifiedList = [];
  // First, add existing conversations that match the filter
  conversations.forEach(conv => {
    const peer = conv.participants.find(p => p._id.toString() !== agentId.toString());
    if (peer) {
      const isAllowed = potentialUsers.some(u => u._id.toString() === peer._id.toString());
      if (isAllowed) {
        unifiedList.push(conv);
      }
    }
  });

  // Then, add potential users who don't have a conversation yet (Virtual Conversations)
  potentialUsers.forEach(user => {
    const userIdStr = user._id.toString();
    if (!existingConvMap.has(userIdStr)) {
      unifiedList.push({
        _id: user._id,
        id: user._id, // Support both _id and id
        isVirtual: true,
        participants: [req.user, user],
        participantType: 'direct',
        unreadCount: 0,
        unreadCounts: { [agentId.toString()]: 0, [userIdStr]: 0 },
        lastMessage: 'No messages yet.',
        lastMessageTime: null
      });
    }
  });

  // Sort: Active conversations first, then virtual ones
  unifiedList.sort((a, b) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });

  sendSuccess(res, 'Conversations fetched successfully', {
    conversations: unifiedList,
    assignedBorrowers,
    relatedStaff,
    adminSupport
  });
});

/**
 * Helper to validate if an agent is allowed to communicate with a specific peer
 */
const validateParticipantAccess = async (agentId, peerId) => {
  const agentProfile = await Agent.findOne({ userId: agentId });
  const assignedBorrowerIds = agentProfile?.assignedBorrowers?.map(id => id.toString()) || [];

  // 1. Is it an assigned borrower?
  if (assignedBorrowerIds.includes(peerId.toString())) return true;

  const peer = await User.findById(peerId);
  if (!peer) return false;

  // 2. Is it an active admin?
  if (peer.role === 'admin' && peer.isActive) return true;

  // 3. Is it a related staff member?
  if (peer.role === 'staff' && peer.isActive) {
    const relatedApp = await LoanApplication.findOne({
      borrowerId: { $in: assignedBorrowerIds },
      'staffReview.reviewedBy': peerId
    });
    if (relatedApp) return true;
  }

  return false;
};

/**
 * @desc    Get single conversation history
 * @route   GET /api/agent/communications/:id
 * @access  Private/Agent
 */
const getConversation = asyncHandler(async (req, res) => {
  const { id } = req.params; // Can be conversationId or peerUserId
  const agentId = req.user._id;

  let conversation;
  let peerId = id;

  // Try finding by conversation ID
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    conversation = await Conversation.findOne({ _id: id, participants: agentId })
      .populate('participants', 'fullName email role profilePhoto status isActive');
    
    if (conversation) {
      const peer = conversation.participants.find(p => p._id.toString() !== agentId.toString());
      peerId = peer?._id;
    }
  }

  // Security Check: Is the agent allowed to talk to this peer?
  if (peerId) {
    const hasAccess = await validateParticipantAccess(agentId, peerId);
    if (!hasAccess) return sendError(res, 'Unauthorized conversation access', 403);
  }

  // If not found or id was a user ID, find conversation between them
  if (!conversation) {
    conversation = await Conversation.findOne({
      participants: { $all: [agentId, peerId] },
      participantType: 'direct'
    }).populate('participants', 'fullName email role profilePhoto status isActive');

    if (!conversation) {
      // Create a new one if it doesn't exist (Virtual to Real transition)
      const peerUser = await User.findById(peerId).select('fullName email role profilePhoto');
      if (!peerUser) return sendError(res, 'Participant not found', 404);

      conversation = await Conversation.create({
        participants: [agentId, peerId],
        participantType: 'direct',
        unreadCounts: { [agentId.toString()]: 0, [peerId.toString()]: 0 }
      });
      await conversation.populate('participants', 'fullName email role profilePhoto status isActive');
    }
  }

  const messages = await Message.find({ conversationId: conversation._id, isDeleted: false })
    .populate('senderId', 'fullName role profilePhoto')
    .sort({ createdAt: 1 });

  sendSuccess(res, 'Conversation history fetched', { conversation, messages });
});

/**
 * @desc    Send a message
 * @route   POST /api/agent/communications/send
 * @access  Private/Agent
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId, receiverId, message, messageType } = req.body;
  const agentId = req.user._id;

  let conversation;
  let peerId = receiverId;

  if (conversationId) {
    conversation = await Conversation.findOne({ _id: conversationId, participants: agentId });
    if (conversation) {
      peerId = conversation.participants.find(p => p.toString() !== agentId.toString());
    }
  }

  if (!peerId) return sendError(res, 'Recipient not specified', 400);

  // Security Check
  const hasAccess = await validateParticipantAccess(agentId, peerId);
  if (!hasAccess) return sendError(res, 'Unauthorized message recipient', 403);

  if (!conversation) {
    conversation = await Conversation.findOne({
      participants: { $all: [agentId, peerId] },
      participantType: 'direct'
    });
    
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [agentId, peerId],
        participantType: 'direct',
        unreadCounts: { [agentId.toString()]: 0, [peerId.toString()]: 0 }
      });
    }
  }

  const newMessage = await Message.create({
    conversationId: conversation._id,
    senderId: agentId,
    senderRole: req.user.role,
    receiverId: peerId,
    message: message,
    messageText: message, // Backward compatibility
    messageType: messageType || 'text',
    isDelivered: true
  });

  // Update conversation
  const peerIdStr = newMessage.receiverId.toString();
  const currentUnread = conversation.unreadCounts.get(peerIdStr) || 0;
  conversation.unreadCounts.set(peerIdStr, currentUnread + 1);
  conversation.lastMessage = message;
  conversation.lastMessageTime = new Date();
  await conversation.save();

  await newMessage.populate('senderId', 'fullName role profilePhoto');

  // Real-time broadcast
  const io = getIO();
  const roomId = conversation._id.toString();
  
  // Emit to the conversation room for active chat windows
  io.to(roomId).emit('message:received', newMessage);
  io.to(roomId).emit('receiveMessage', newMessage);
  io.to(roomId).emit('receive_message', newMessage);

  // Unread count update for receiver
  io.emit(`unread:updated_${peerIdStr}`, { conversationId: conversation._id, unreadCount: (conversation.unreadCounts.get(peerIdStr) || 0) });
  
  // Direct events for sidebar updates and notifications
  io.emit(`receiveMessage_${peerIdStr}`, newMessage);
  io.emit(`receive_message_${peerIdStr}`, newMessage);
  io.emit(`receiveMessage_${agentId}`, newMessage);
  io.emit(`receive_message_${agentId}`, newMessage);
  
  // Notification for receiver
  try {
    const receiver = await User.findById(peerIdStr);
    if (receiver) {
      await createNotification({
        receiverId: peerIdStr,
        receiverRole: receiver.role,
        senderId: agentId,
        senderRole: 'agent',
        notificationType: 'NewMessage',
        title: `New message from ${req.user.fullName}`,
        message: message.length > 50 ? message.substring(0, 47) + '...' : message,
        relatedId: conversation._id,
        relatedModel: 'Conversation'
      });
    }
  } catch (err) {}

  sendSuccess(res, 'Message sent', newMessage);
});

/**
 * @desc    Create follow-up reminder
 * @route   POST /api/agent/communications/reminder
 * @access  Private/Agent
 */
const createReminder = asyncHandler(async (req, res) => {
  const { borrowerId, reminderMessage, followUpDate } = req.body;
  const agentId = req.user._id;

  // 1. Find or create conversation
  let conversation = await Conversation.findOne({
    participants: { $all: [agentId, borrowerId] },
    participantType: 'direct'
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [agentId, borrowerId],
      participantType: 'direct',
      unreadCounts: { [agentId.toString()]: 0, [borrowerId.toString()]: 0 }
    });
  }

  // 2. Create the reminder message
  const message = `Reminder: ${reminderMessage}. Follow-up scheduled for ${new Date(followUpDate).toLocaleDateString()}`;
  
  const newMessage = await Message.create({
    conversationId: conversation._id,
    senderId: agentId,
    senderRole: 'agent',
    receiverId: borrowerId,
    message: message,
    messageType: 'reminder',
    isDelivered: true
  });

  conversation.lastMessage = message;
  conversation.lastMessageTime = new Date();
  const peerId = borrowerId.toString();
  const currentUnread = conversation.unreadCounts.get(peerId) || 0;
  conversation.unreadCounts.set(peerId, currentUnread + 1);
  await conversation.save();

  // 3. Create borrower notification
  await createNotification({
    receiverId: borrowerId,
    receiverRole: 'borrower',
    senderId: agentId,
    senderRole: 'agent',
    notificationType: 'Reminder',
    title: 'Payment/Follow-up Reminder',
    message: reminderMessage,
    relatedId: conversation._id,
    relatedModel: 'Conversation',
    priority: 'important'
  });

  // 4. Socket broadcast
  const io = getIO();
  io.to(conversation._id.toString()).emit('message:received', await newMessage.populate('senderId', 'fullName role profilePhoto'));

  sendSuccess(res, 'Reminder sent and notification created');
});

/**
 * @desc    Mark conversation as read
 * @route   PUT /api/agent/communications/read/:conversationId
 * @access  Private/Agent
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const agentId = req.user._id;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return sendError(res, 'Conversation not found', 404);

  conversation.unreadCounts.set(agentId.toString(), 0);
  await conversation.save();

  await Message.updateMany(
    { conversationId, receiverId: agentId, isRead: false },
    { isRead: true }
  );

  const io = getIO();
  io.emit(`unread:updated_${agentId}`, { conversationId, unreadCount: 0 });

  sendSuccess(res, 'Messages marked as read');
});

/**
 * @desc    Search conversations
 * @route   GET /api/agent/communications/search
 * @access  Private/Agent
 */
const searchConversations = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const agentId = req.user._id;

  // 1. Get Authorized Peer List
  const agentProfile = await Agent.findOne({ userId: agentId });
  const assignedBorrowerIds = agentProfile?.assignedBorrowers || [];

  const relatedApplications = await LoanApplication.find({
    borrowerId: { $in: assignedBorrowerIds }
  }).select('staffReview.reviewedBy');

  const relatedStaffIds = [...new Set(relatedApplications
    .map(app => app.staffReview?.reviewedBy)
    .filter(id => id != null)
  )];

  const authorizedRoles = ['admin']; // All admins are authorized

  // 2. Find Users that match search AND are authorized
  const users = await User.find({
    $and: [
      {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      },
      {
        $or: [
          { _id: { $in: assignedBorrowerIds } },
          { _id: { $in: relatedStaffIds } },
          { role: { $in: authorizedRoles } }
        ]
      }
    ]
  }).select('_id fullName email role profilePhoto status isActive');

  const userIds = users.map(u => u._id);

  // 3. Find existing conversations with these users
  const conversations = await Conversation.find({
    participants: agentId,
    isDeleted: false,
    participants: { $in: userIds }
  }).populate('participants', 'fullName email role profilePhoto status isActive');

  const existingPeerIds = conversations.map(c => 
    c.participants.find(p => p._id.toString() !== agentId.toString())._id.toString()
  );

  // 4. Create virtual conversations for users found in search but no conversation exists
  const unifiedResults = [...conversations];
  users.forEach(user => {
    if (!existingPeerIds.includes(user._id.toString())) {
      unifiedResults.push({
        _id: user._id,
        id: user._id,
        isVirtual: true,
        participants: [req.user, user],
        participantType: 'direct',
        unreadCount: 0,
        lastMessage: 'No messages yet.',
        lastMessageTime: null
      });
    }
  });

  sendSuccess(res, 'Search results', unifiedResults);
});

module.exports = {
  getConversations,
  getConversation,
  sendMessage,
  createReminder,
  markAsRead,
  searchConversations
};
