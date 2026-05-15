const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Borrower = require('./src/models/Borrower');

async function listBorrowers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const borrowers = await Borrower.find({}).limit(5).lean();
    console.log('Valid Borrowers:', borrowers.map(b => ({ id: b._id, name: b.fullName })));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

listBorrowers();
