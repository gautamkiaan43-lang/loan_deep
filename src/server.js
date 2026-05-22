const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('./config/db');
const app = require('./app');
const { initializeDatanamixAuth } = require('./services/datanamix/datanamixAuth.service');

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

const { initSocket } = require('./socket/socketServer');
const { initCronJobs } = require('./services/cronService');

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`✅ ImageKit initialized`);
});

// Initialize Datanamix authentication asynchronously — non-blocking startup
initializeDatanamixAuth().catch((err) => {
  console.error('[Datanamix] Fatal auth bootstrap error:', err.message);
});

// Initialize Socket.IO
initSocket(server);
console.log(`📡 Socket.IO initialized`);

// Initialize Cron Jobs
initCronJobs();
console.log(`⏰ Cron Jobs initialized`);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Error: ${err.message}`);
  // Close server & exit process
  // server.close(() => process.exit(1));
});
