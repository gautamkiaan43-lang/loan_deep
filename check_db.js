const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const ActiveLoan = require('./src/models/ActiveLoan');
const Borrower = require('./src/models/Borrower');
const User = require('./src/models/User');

async function checkAssignments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const agentUser = await User.findOne({ email: 'agent@lms.com' });
    if (!agentUser) {
      console.log('Agent User not found');
      return;
    }
    console.log('Agent User ID:', agentUser._id);

    const loans = await ActiveLoan.find({ assignedAgent: agentUser._id });
    console.log('Assigned Loans Count:', loans.length);
    loans.forEach(l => {
      console.log(`Loan: ${l.loanCode}, Assigned Agent Field: ${l.assignedAgent}`);
    });

    const borrowers = await Borrower.find({ assignedAgent: agentUser._id });
    console.log('Assigned Borrowers Count:', borrowers.length);

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkAssignments();
