const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Notification = require('./src/models/Notification');
  const User = require('./src/models/User');
  
  // Find Agent User
  const agent = await User.findOne({ role: 'agent' });
  if (!agent) {
    console.log('No agent found');
    process.exit(0);
  }

  const stats = await Notification.aggregate([
    { $match: { receiverId: agent._id } },
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);
  console.log('STATS:', stats);

  const unreadCount = await Notification.countDocuments({
    receiverId: agent._id,
    status: 'UNREAD'
  });
  console.log('UNREAD COUNT FOR AGENT:', unreadCount);

  const latestNotif = await Notification.findOne({ receiverId: agent._id }).sort({ createdAt: -1 });
  console.log('LATEST NOTIF:', latestNotif);

  process.exit(0);
});
