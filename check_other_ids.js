const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
require('dotenv').config();

const checkOtherIds = async () => {
  await connectDB();
  const appId = '6a05bcb9f1101562904b706a';
  const emp = await mongoose.connection.db.collection('loanemployments').findOne({ loanApplicationId: new mongoose.Types.ObjectId(appId) });
  const bank = await mongoose.connection.db.collection('loanbankings').findOne({ loanApplicationId: new mongoose.Types.ObjectId(appId) });
  
  if (emp) console.log('Employment ID:', emp._id);
  if (bank) console.log('Banking ID:', bank._id);
  
  process.exit(0);
};

checkOtherIds();
