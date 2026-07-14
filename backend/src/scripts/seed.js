const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const {
  User,
  Department,
  Designation,
  LeaveType,
  LeavePolicy,
  EmployeeLeaveBalance,
  Holiday,
  Announcement,
  AuditLog
} = require('../models');

const seedDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('MONGODB_URI not found in environment.');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected! Wiping existing collections...');

    // Clear existing data
    await User.deleteMany({});
    await Department.deleteMany({});
    await Designation.deleteMany({});
    await LeaveType.deleteMany({});
    await LeavePolicy.deleteMany({});
    await EmployeeLeaveBalance.deleteMany({});
    await Holiday.deleteMany({});
    await Announcement.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('Collections cleared. Seeding initial structures...');

    // 1. Create Departments
    const engineering = await Department.create({ name: 'Engineering', description: 'Software Development & Architecture' });
    const hr = await Department.create({ name: 'Human Resources', description: 'Talent Acquisition & Employee Success' });
    const leadership = await Department.create({ name: 'Leadership', description: 'Executive Management' });

    // 2. Create Designations
    const director = await Designation.create({ name: 'Director', description: 'Executive level manager' });
    const hrMgr = await Designation.create({ name: 'HR Manager', description: 'Human Resource Team Lead' });
    const devLead = await Designation.create({ name: 'Engineering Lead', description: 'Technical Lead' });
    const seniorDev = await Designation.create({ name: 'Senior Software Engineer', description: 'Full Stack Developer' });

    // 3. Create Leave Types
    const sl = await LeaveType.create({ name: 'Sick Leave', code: 'SL', description: 'Leave due to illness' });
    const cl = await LeaveType.create({ name: 'Casual Leave', code: 'CL', description: 'General personal leave' });
    const pl = await LeaveType.create({ name: 'Privilege Leave', code: 'PL', description: 'Earned vacation leave' });
    const wfh = await LeaveType.create({ name: 'Work From Home', code: 'WFH', description: 'Remote work allocation' });
    const lop = await LeaveType.create({ name: 'Loss Of Pay', code: 'LOP', description: 'Unpaid leave options' });
    const ml = await LeaveType.create({ name: 'Medical Leave', code: 'ML', description: 'Long term medical recovery' });

    console.log('Leave Types seeded. Creating Leave Policy...');

    // 4. Create Default Leave Policy
    const defaultPolicy = await LeavePolicy.create({
      name: 'Default Employee Policy',
      description: 'Standard Leave configuration for all full-time employees',
      isDefault: true,
      rules: [
        {
          leaveType: sl._id,
          monthlyAllocation: 2,
          yearlyAllocation: 24,
          carryForward: false,
          maxCarryForward: 0,
          halfDayAllowed: true,
          requiresMedicalCertificate: true,
          minConsecutiveDaysForMedical: 2,
          encashmentAllowed: false,
          genderRestriction: 'All',
          minServiceDurationMonths: 0,
          maxConsecutiveDays: 14,
          sandwichPolicy: false,
          weekendRules: 'Exclude',
          holidayRules: 'Exclude',
          requiredDocuments: true
        },
        {
          leaveType: cl._id,
          monthlyAllocation: 3,
          yearlyAllocation: 36,
          carryForward: true,
          maxCarryForward: 12,
          halfDayAllowed: true,
          requiresMedicalCertificate: false,
          encashmentAllowed: false,
          genderRestriction: 'All',
          minServiceDurationMonths: 0,
          maxConsecutiveDays: 5,
          sandwichPolicy: true, // Sandwich policy enabled for Casual Leave
          weekendRules: 'Exclude',
          holidayRules: 'Exclude'
        },
        {
          leaveType: pl._id,
          monthlyAllocation: 1,
          yearlyAllocation: 12,
          carryForward: true,
          maxCarryForward: 12,
          halfDayAllowed: false,
          requiresMedicalCertificate: false,
          encashmentAllowed: true,
          genderRestriction: 'All',
          minServiceDurationMonths: 6, // Eligible after 6 months of service
          maxConsecutiveDays: 30,
          sandwichPolicy: false,
          weekendRules: 'Exclude',
          holidayRules: 'Exclude'
        },
        {
          leaveType: wfh._id,
          monthlyAllocation: 3,
          yearlyAllocation: 36,
          carryForward: false,
          maxCarryForward: 0,
          halfDayAllowed: true,
          requiresMedicalCertificate: false,
          encashmentAllowed: false,
          genderRestriction: 'All',
          minServiceDurationMonths: 0,
          maxConsecutiveDays: 5,
          sandwichPolicy: false,
          weekendRules: 'Exclude',
          holidayRules: 'Exclude'
        },
        {
          leaveType: lop._id,
          monthlyAllocation: 0,
          yearlyAllocation: 999, // Unpaid leaves
          carryForward: false,
          maxCarryForward: 0,
          halfDayAllowed: true,
          requiresMedicalCertificate: false,
          encashmentAllowed: false,
          genderRestriction: 'All',
          minServiceDurationMonths: 0,
          maxConsecutiveDays: 90,
          sandwichPolicy: true,
          weekendRules: 'Include', // Weekend is counted as leave for unpaid Loss of Pay
          holidayRules: 'Include'
        },
        {
          leaveType: ml._id,
          monthlyAllocation: 1,
          yearlyAllocation: 12,
          carryForward: true,
          maxCarryForward: 12,
          halfDayAllowed: false,
          requiresMedicalCertificate: true,
          minConsecutiveDaysForMedical: 1,
          encashmentAllowed: false,
          genderRestriction: 'All',
          minServiceDurationMonths: 0,
          maxConsecutiveDays: 180,
          sandwichPolicy: false,
          weekendRules: 'Exclude',
          holidayRules: 'Exclude',
          requiredDocuments: true
        }
      ]
    });

    console.log('Seeding Sample Users...');

    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('Admin@123', salt);
    const hrPassword = await bcrypt.hash('Hr@123', salt);
    const managerPassword = await bcrypt.hash('Manager@123', salt);
    const employeePassword = await bcrypt.hash('Employee@123', salt);

    // Create Super Admin
    const superAdminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@company.com',
      password: adminPassword,
      role: 'Super Admin',
      department: leadership._id,
      designation: director._id,
      gender: 'Male',
      joiningDate: new Date('2023-01-01'),
      status: 'Active'
    });

    // Create HR Admin
    const hrAdminUser = await User.create({
      name: 'Sarah HR',
      email: 'hr@company.com',
      password: hrPassword,
      role: 'HR Admin',
      department: hr._id,
      designation: hrMgr._id,
      gender: 'Female',
      manager: superAdminUser._id,
      joiningDate: new Date('2024-01-01'),
      status: 'Active'
    });

    // Create Manager
    const managerUser = await User.create({
      name: 'John Developer Lead',
      email: 'manager@company.com',
      password: managerPassword,
      role: 'Manager',
      department: engineering._id,
      designation: devLead._id,
      gender: 'Male',
      manager: superAdminUser._id,
      joiningDate: new Date('2024-06-01'),
      status: 'Active'
    });

    // Create Employee
    const employeeUser = await User.create({
      name: 'Jane Doe',
      email: 'employee@company.com',
      password: employeePassword,
      role: 'Employee',
      department: engineering._id,
      designation: seniorDev._id,
      gender: 'Female',
      manager: managerUser._id,
      joiningDate: new Date('2025-01-01'),
      emergencyContact: {
        name: 'Richard Doe',
        relation: 'Spouse',
        phone: '+1-555-0199'
      },
      status: 'Active'
    });

    console.log('Seeding leave balances for employees...');
    const users = [superAdminUser, hrAdminUser, managerUser, employeeUser];
    const leaveTypes = [sl, cl, pl, wfh, lop, ml];

    // Seed balances
    for (const u of users) {
      for (const lt of leaveTypes) {
        // Find matching policy rule to seed initial remaining balances
        const rule = defaultPolicy.rules.find(r => r.leaveType.toString() === lt._id.toString());
        
        let initialRemaining = 0;
        if (rule) {
          // Grant a healthy starter balance (e.g. 5x monthly allocation to make it look active)
          initialRemaining = rule.monthlyAllocation * 5;
          if (lt.code === 'LOP') initialRemaining = 999; // Loss of pay is unlimited
        }

        await EmployeeLeaveBalance.create({
          employee: u._id,
          leaveType: lt._id,
          available: initialRemaining,
          used: 0,
          remaining: initialRemaining,
          carryForwarded: 0,
          creditedThisMonth: rule ? rule.monthlyAllocation : 0
        });
      }
    }

    console.log('Seeding upcoming holidays...');
    await Holiday.create([
      { name: 'New Year Day', date: new Date('2026-01-01'), description: 'International New Year celebration' },
      { name: 'Independence Day', date: new Date('2026-08-15'), description: 'National Independence Day' },
      { name: 'Labor Day', date: new Date('2026-09-07'), description: 'Appreciation for laborers' },
      { name: 'Thanksgiving', date: new Date('2026-11-26'), description: 'Thanksgiving Holiday' },
      { name: 'Christmas Day', date: new Date('2026-12-25'), description: 'Christmas celebration' }
    ]);

    console.log('Seeding announcements...');
    await Announcement.create({
      title: 'Welcome to the New HR Leave Management Portal!',
      content: 'We have updated our internal leave policy tracking and approval engine. Please configure your emergency contacts and check your leave balances. If you find any discrepancies, reach out to HR Sarah.',
      author: hrAdminUser._id
    });

    console.log('Database seeded successfully!');
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failure:', error);
    process.exit(1);
  }
};

seedDatabase();
