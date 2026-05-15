const express = require('express');
const router = express.Router();
const communicationController = require('../../controllers/borrower/communicationController');
const { protect } = require('../../middlewares/authMiddleware');
const upload = require('../../middlewares/uploadMiddleware');

// All routes are protected
router.use(protect);

// Conversation Routes
router.get('/conversations', communicationController.getConversations);
router.get('/conversations/:id/messages', communicationController.getMessages);

// Message Routes
router.post('/messages/send', upload.single('attachment'), communicationController.sendMessage);
router.patch('/messages/read', communicationController.markRead);

// Notification Routes
router.get('/notifications', communicationController.getNotifications);
router.patch('/notifications/:id/read', communicationController.markNotificationRead);

// Participant Routes
router.get('/participants', communicationController.getParticipants);
router.post('/conversations/start', communicationController.startConversation);

module.exports = router;
