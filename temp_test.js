const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { createNotification } = require('./src/utils/notificationHelper');
  const User = require('./src/models/User');

  const admin = await User.findOne({ role: 'admin' });
  const agent = await User.findOne({ role: 'agent' });

  try {
    const notif = await createNotification({
      receiverId: agent._id,
      receiverRole: agent.role,
      senderId: admin._id,
      senderRole: admin.role,
      notificationType: 'AdminMessage',
      title: 'New Message from Admin Test',
      message: 'Test message',
      relatedId: admin._id,
      relatedModel: 'Conversation',
      priority: 'normal'
    });
    console.log('CREATED NOTIF:', notif);
  } catch (err) {
    console.error('ERROR CREATING NOTIF:', err);
  }

  process.exit(0);
});
