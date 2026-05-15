const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const ActiveLoan = require('./src/models/ActiveLoan');

async function checkAllAssignments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const loans = await ActiveLoan.find({ assignedAgent: { $exists: true, $ne: null } });
    console.log('Total Assigned Loans:', loans.length);
    loans.forEach(l => {
      console.log(`Loan: ${l.loanCode}, Assigned Agent ID: ${l.assignedAgent}, Borrower: ${l.borrowerName}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkAllAssignments();
