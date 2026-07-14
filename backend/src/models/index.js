const mongoose = require('mongoose');
const { Schema } = mongoose;

// ==========================================
// USER SCHEMA
// ==========================================
const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Super Admin', 'HR Admin', 'Manager', 'Employee'], 
    default: 'Employee' 
  },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  designation: { type: Schema.Types.ObjectId, ref: 'Designation' },
  manager: { type: Schema.Types.ObjectId, ref: 'User' },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  joiningDate: { type: Date, default: Date.now },
  emergencyContact: {
    name: { type: String },
    relation: { type: String },
    phone: { type: String }
  },
  avatar: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// DEPARTMENT SCHEMA
// ==========================================
const DepartmentSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  manager: { type: Schema.Types.ObjectId, ref: 'User' }
});

// ==========================================
// DESIGNATION SCHEMA
// ==========================================
const DesignationSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String }
});

// ==========================================
// LEAVE TYPE SCHEMA
// ==========================================
const LeaveTypeSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true }, // e.g., SL, CL, PL, WFH, LOP, ML
  description: { type: String }
});

// ==========================================
// LEAVE POLICY SCHEMA
// ==========================================
const LeavePolicySchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isDefault: { type: Boolean, default: false },
  rules: [{
    leaveType: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    monthlyAllocation: { type: Number, default: 0 },
    yearlyAllocation: { type: Number, default: 0 },
    carryForward: { type: Boolean, default: false },
    maxCarryForward: { type: Number, default: 0 },
    halfDayAllowed: { type: Boolean, default: true },
    requiresMedicalCertificate: { type: Boolean, default: false },
    minConsecutiveDaysForMedical: { type: Number, default: 2 },
    encashmentAllowed: { type: Boolean, default: false },
    genderRestriction: { type: String, enum: ['All', 'Male', 'Female'], default: 'All' },
    departmentRestriction: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    minServiceDurationMonths: { type: Number, default: 0 },
    maxConsecutiveDays: { type: Number, default: 30 },
    sandwichPolicy: { type: Boolean, default: false },
    weekendRules: { type: String, enum: ['Exclude', 'Include'], default: 'Exclude' },
    holidayRules: { type: String, enum: ['Exclude', 'Include'], default: 'Exclude' },
    requiredDocuments: { type: Boolean, default: false }
  }],
  assignedEmployees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  assignedDepartments: [{ type: Schema.Types.ObjectId, ref: 'Department' }]
});

// ==========================================
// EMPLOYEE LEAVE BALANCE SCHEMA
// ==========================================
const EmployeeLeaveBalanceSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leaveType: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  available: { type: Number, default: 0 },
  used: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  carryForwarded: { type: Number, default: 0 },
  creditedThisMonth: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

EmployeeLeaveBalanceSchema.index({ employee: 1, leaveType: 1 }, { unique: true });

// ==========================================
// LEAVE APPLICATION SCHEMA
// ==========================================
const LeaveApplicationSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leaveType: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isHalfDay: { type: Boolean, default: false },
  halfDaySession: { type: String, enum: ['Morning', 'Afternoon', 'None'], default: 'None' },
  duration: { type: Number, required: true }, // e.g. 0.5, 1, 3
  reason: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], 
    default: 'Pending' 
  },
  managerApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Changes_Requested'], default: 'Pending' },
    comment: { type: String, default: '' },
    updatedAt: { type: Date }
  },
  hrApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    comment: { type: String, default: '' },
    updatedAt: { type: Date }
  },
  medicalCertificateUrl: { type: String, default: '' },
  delegatedWorkTo: { type: Schema.Types.ObjectId, ref: 'User' },
  emergencyContact: { type: String },
  datesApplied: [{ type: Date }], // Explicit list of calendar dates this leave covers
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// HOLIDAY SCHEMA
// ==========================================
const HolidaySchema = new Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true, unique: true },
  isOptional: { type: Boolean, default: false },
  description: { type: String }
});

// ==========================================
// NOTIFICATION SCHEMA
// ==========================================
const NotificationSchema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  type: { 
    type: String, 
    enum: ['Applied', 'Approved', 'Rejected', 'Cancelled', 'System', 'Announcement', 'Credit'], 
    default: 'System' 
  },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// ANNOUNCEMENT SCHEMA
// ==========================================
const AnnouncementSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetDepartments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
  targetRoles: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// AUDIT LOG SCHEMA
// ==========================================
const AuditLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  details: { type: String },
  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Create Mongoose models
const User = mongoose.model('User', UserSchema);
const Department = mongoose.model('Department', DepartmentSchema);
const Designation = mongoose.model('Designation', DesignationSchema);
const LeaveType = mongoose.model('LeaveType', LeaveTypeSchema);
const LeavePolicy = mongoose.model('LeavePolicy', LeavePolicySchema);
const EmployeeLeaveBalance = mongoose.model('EmployeeLeaveBalance', EmployeeLeaveBalanceSchema);
const LeaveApplication = mongoose.model('LeaveApplication', LeaveApplicationSchema);
const Holiday = mongoose.model('Holiday', HolidaySchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const Announcement = mongoose.model('Announcement', AnnouncementSchema);
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = {
  User,
  Department,
  Designation,
  LeaveType,
  LeavePolicy,
  EmployeeLeaveBalance,
  LeaveApplication,
  Holiday,
  Notification,
  Announcement,
  AuditLog
};
