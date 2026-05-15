const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const ActiveLoan = require('./src/models/ActiveLoan');
const Borrower = require('./src/models/Borrower');

async function testGetClients() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Simulating getClients logic
    const userId = '6a02dcd95534cff8d9fef99b'; // Agent User ID
    const query = { assignedAgent: userId, isDeleted: false };
    
    const loans = await ActiveLoan.find(query).populate('borrowerId');
    console.log('Found', loans.length, 'loans');

    const clients = loans.map(loan => {
      console.log('Loan borrowerId type:', typeof loan.borrowerId);
      console.log('Loan borrowerId keys:', loan.borrowerId ? Object.keys(loan.borrowerId.toObject ? loan.borrowerId.toObject() : loan.borrowerId) : 'null');
      
      return {
        _id: loan._id,
        borrowerId: loan.borrowerId?._id,
        borrowerName: loan.borrowerName,
      };
    });

    console.log('Client Data:', JSON.stringify(clients, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

testGetClients();
