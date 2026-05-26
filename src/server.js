const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables: .env.development in development mode, then fallback to .env
const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv === 'development') {
  const devEnvPath = path.join(__dirname, '../.env.development');
  if (fs.existsSync(devEnvPath)) {
    dotenv.config({ path: devEnvPath });
  }
}
dotenv.config({ path: path.join(__dirname, '../.env') });

// Hard Production Protection Safeguard
if (
  process.env.NODE_ENV === 'production' &&
  (
    process.env.DEV_ONLY_BYPASS_SEQUENTIAL_GATING === 'true' ||
    process.env.DEV_ONLY_BYPASS_NEXT_STEP === 'true'
  )
) {
  throw new Error(
    '[SECURITY] Development bypass flags detected in production environment.'
  );
}


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
