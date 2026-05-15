const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const ActiveLoan = require('./src/models/ActiveLoan');
const Agent = require('./src/models/Agent');
const Borrower = require('./src/models/Borrower');

async function fixAssignments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const loans = await ActiveLoan.find({ assignedAgent: { $exists: true, $ne: null } });
    console.log('Found', loans.length, 'assigned loans to check');

    for (const loan of loans) {
      // Check if assignedAgent is an Agent Model ID or a User ID
      // We can try to find an Agent with this ID
      const agent = await Agent.findById(loan.assignedAgent);
      if (agent) {
        console.log(`Loan ${loan.loanCode}: Found Agent record. Converting Agent ID ${loan.assignedAgent} to User ID ${agent.userId}`);
        loan.assignedAgent = agent.userId;
        await loan.save();

        // Also fix Borrower
        await Borrower.findByIdAndUpdate(loan.borrowerId, { assignedAgent: agent.userId });
      } else {
        console.log(`Loan ${loan.loanCode}: assignedAgent ${loan.assignedAgent} is not an Agent ID (likely already a User ID).`);
      }
    }

    console.log('Migration complete');
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

fixAssignments();
