const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { User, LeavePolicy, Department } = require('../models');

async function checkDatabase() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to database...');

  if (!uri) {
    console.error('Error: MONGODB_URI not set.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('[Mongoose] Connected successfully.');

    const admin = await User.findOne({ email: 'admin@company.com' });
    if (!admin) {
      console.log('Admin user admin@company.com not found!');
    } else {
      console.log('Found Admin User. Hashed Password in DB:', admin.password);
      const matches = await bcrypt.compare('Admin@123', admin.password);
      console.log('Does "Admin@123" match hash?', matches);
    }

    const deptCount = await Department.countDocuments({});
    console.log('Departments Count:', deptCount);

    const policyCount = await LeavePolicy.countDocuments({});
    console.log('Policies Count:', policyCount);

    mongoose.connection.close();
  } catch (err) {
    console.error('[Error] DB Check Failed:', err.message);
  }
}

checkDatabase();
