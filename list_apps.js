const mongoose = require('mongoose');
const LoanApplication = require('./src/models/LoanApplication');
const connectDB = require('./src/config/db');
require('dotenv').config();

const listApps = async () => {
  await connectDB();
  const apps = await LoanApplication.find({}, { _id: 1, applicationId: 1, status: 1 });
  console.log('Total Apps:', apps.length);
  apps.forEach(app => console.log(`ID: ${app._id}, Code: ${app.applicationId}, Status: ${app.status}`));
  process.exit(0);
};

listApps();
