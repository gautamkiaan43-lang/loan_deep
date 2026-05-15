const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const ActiveLoan = require('./src/models/ActiveLoan');

async function inspectLoan() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const loan = await ActiveLoan.findOne({ loanCode: 'P47-001' }).lean();
    console.log('Loan Record:', JSON.stringify(loan, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

inspectLoan();
