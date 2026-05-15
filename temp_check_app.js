const mongoose = require('mongoose');
const LoanApplication = require('./src/models/LoanApplication');
const connectDB = require('./src/config/db');
require('dotenv').config();

const checkApp = async () => {
  await connectDB();
  const id = '6a05bcb9f1101562904b706c';
  const app = await LoanApplication.findById(id);
  console.log('App Found:', !!app);
  if (app) console.log('App Status:', app.status);
  
  // Also check by applicationId if maybe it was passed wrong
  const appByCode = await LoanApplication.findOne({ applicationId: id });
  console.log('App Found by Code:', !!appByCode);
  
  process.exit(0);
};

checkApp();
