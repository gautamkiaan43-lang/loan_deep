const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Borrower = require('./src/models/Borrower');

async function checkBorrower() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const borrower = await Borrower.findById('6a02dcd95534cff8d9fef99c').lean();
    console.log('Borrower Record:', borrower ? 'Found' : 'NOT FOUND');

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkBorrower();
