const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const ActiveLoan = require('./src/models/ActiveLoan');
const Borrower = require('./src/models/Borrower');
const User = require('./src/models/User');

dotenv.config({ path: path.join(__dirname, '.env') });

const diagnose = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const email = 'borrower@lms.com';
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('User found:', user._id, user.fullName);

    const allLoans = await ActiveLoan.find({});
    console.log(`Total active loans in DB: ${allLoans.length}`);
    allLoans.forEach(l => {
      console.log(`Loan ID: ${l._id}, borrowerId: ${l.borrowerId}, Code: ${l.loanCode}`);
    });

    const allBorrowers = await Borrower.find({});
    console.log(`Total borrowers in DB: ${allBorrowers.length}`);
    allBorrowers.forEach(b => {
      console.log(`Borrower ID: ${b._id}, linked userId: ${b.userId}, Name: ${b.fullName}`);
    });

    const borrower = await Borrower.findOne({ userId: user._id });
    if (!borrower) {
      console.log('Borrower profile NOT FOUND for user', user._id);
    } else {
      console.log('Borrower profile found:', borrower._id);
      
      const loans = await ActiveLoan.find({ borrowerId: borrower._id });
      console.log(`Found ${loans.length} loans for borrower ${borrower._id}`);
      
      if (loans.length === 0) {
        // Check if there are loans linked directly to userId (incorrect but possible)
        const wrongLoans = await ActiveLoan.find({ borrowerId: user._id });
        console.log(`Found ${wrongLoans.length} loans incorrectly linked to userId ${user._id}`);
        
        if (wrongLoans.length > 0) {
          console.log('FIX REQUIRED: Loans are linked to User ID instead of Borrower Profile ID');
        }
      }
    }

    mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};

diagnose();
