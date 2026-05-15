const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const connectDB = require('../config/db');

// Load env vars
dotenv.config({ path: './.env' });

const users = [
  {
    fullName: 'Admin User',
    email: 'admin@lms.com',
    password: 'admin123',
    phone: '1234567890',
    role: 'admin'
  },
  {
    fullName: 'Staff User',
    email: 'staff@lms.com',
    password: 'staff123',
    phone: '1234567891',
    role: 'staff'
  },
  {
    fullName: 'Agent User',
    email: 'agent@lms.com',
    password: 'agent123',
    phone: '1234567892',
    role: 'agent'
  },
  {
    fullName: 'Borrower User',
    email: 'borrower@lms.com',
    password: 'borrower123',
    phone: '1234567893',
    role: 'borrower'
  }
];

const seedUsers = async () => {
  try {
    await connectDB();

    for (const u of users) {
      const userExists = await User.findOne({ email: u.email });
      if (userExists) {
        console.log(`User ${u.email} already exists, updating password...`);
        userExists.password = u.password;
        await userExists.save();
      } else {
        await User.create(u);
        console.log(`User ${u.email} created.`);
      }
    }

    console.log('✅ All users seeded successfully');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedUsers();
