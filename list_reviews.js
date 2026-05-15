const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
require('dotenv').config();

const listReviews = async () => {
  await connectDB();
  const reviews = await mongoose.connection.db.collection('loanreviews').find({}).toArray();
  console.log('Total Reviews:', reviews.length);
  reviews.forEach(r => console.log(`ID: ${r._id}, AppID: ${r.loanApplicationId}`));
  process.exit(0);
};

listReviews();
