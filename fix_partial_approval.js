const mongoose = require('mongoose');
const LoanApplication = require('./src/models/LoanApplication');
const ActiveLoan = require('./src/models/ActiveLoan');
const connectDB = require('./src/config/db');
require('dotenv').config();

const resetApp = async () => {
  await connectDB();
  const id = '6a05bcb9f1101562904b706a';
  const app = await LoanApplication.findById(id);
  const activeLoan = await ActiveLoan.findOne({ loanApplicationId: id });
  
  console.log('App Status:', app?.status);
  console.log('Active Loan Exists:', !!activeLoan);
  
  if (app && app.status === 'Approved' && !activeLoan) {
    console.log('Detected partial approval. Resetting to "Reviewed"...');
    app.status = 'Reviewed';
    await app.save();
    console.log('Reset complete.');
  }
  
  process.exit(0);
};

resetApp();
