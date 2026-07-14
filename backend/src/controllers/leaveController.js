const { LeaveApplication, EmployeeLeaveBalance, User, Notification, AuditLog } = require('../models');
const { validateLeaveApplication } = require('../services/policyEngine');

// Helper to get socket instance
const getIo = (req) => req.app.get('socketio');

// ==========================================
// MOCK CLOUDINARY UPLOADER
// ==========================================
const uploadToCloudinary = async (file) => {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ resource_type: 'raw' }, (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }).end(file.buffer);
    });
  }
  // Fallback mock path for development
  return `/uploads/mock_medical_${Date.now()}_${file.originalname}`;
};

// ==========================================
// APPLY FOR LEAVE
// ==========================================
const applyLeave = async (req, res) => {
  const { leaveType, startDate, endDate, isHalfDay, halfDaySession, reason, delegatedWorkTo, emergencyContact } = req.body;
  const employeeId = req.user._id;

  try {
    let medicalCertificateUrl = '';
    if (req.file) {
      medicalCertificateUrl = await uploadToCloudinary(req.file);
    }

    // Run validations through Policy Engine
    const validation = await validateLeaveApplication(
      employeeId,
      leaveType,
      startDate,
      endDate,
      isHalfDay === 'true' || isHalfDay === true,
      halfDaySession,
      medicalCertificateUrl
    );

    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    const application = await LeaveApplication.create({
      employee: employeeId,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isHalfDay: isHalfDay === 'true' || isHalfDay === true,
      halfDaySession: halfDaySession || 'None',
      duration: validation.duration,
      reason,
      medicalCertificateUrl,
      delegatedWorkTo: delegatedWorkTo || null,
      emergencyContact: emergencyContact || '',
      datesApplied: validation.datesApplied,
      status: 'Pending',
      managerApproval: { status: 'Pending' },
      hrApproval: { status: 'Pending' }
    });

    // Notify employee
    await Notification.create({
      recipient: employeeId,
      title: 'Leave Applied',
      message: `Your leave request for ${validation.duration} day(s) starting ${startDate} has been submitted.`,
      type: 'Applied'
    });

    // Notify Manager
    if (req.user.manager) {
      await Notification.create({
        recipient: req.user.manager,
        title: 'New Leave Request',
        message: `${req.user.name} has applied for ${validation.duration} day(s) of leave starting ${startDate}.`,
        type: 'Applied'
      });

      // Socket.io real-time event
      const io = getIo(req);
      if (io) {
        io.to(req.user.manager.toString()).emit('notification', {
          title: 'New Leave Request',
          message: `${req.user.name} applied for leave.`
        });
      }
    }

    await AuditLog.create({
      user: employeeId,
      action: 'APPLY_LEAVE',
      details: `Applied for leave. ID: ${application._id}, Duration: ${validation.duration} days.`,
      ipAddress: req.ip || ''
    });

    res.status(201).json(application);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// GET LEAVE BALANCES FOR EMPLOYEE
// ==========================================
const getMyLeaveBalances = async (req, res) => {
  try {
    const balances = await EmployeeLeaveBalance.find({ employee: req.user._id })
      .populate('leaveType');
    res.json(balances);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getEmployeeLeaveBalances = async (req, res) => {
  try {
    const balances = await EmployeeLeaveBalance.find({ employee: req.params.id })
      .populate('leaveType');
    res.json(balances);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// GET LEAVE APPLICATIONS (HISTORICAL)
// ==========================================
const getLeaves = async (req, res) => {
  try {
    let query = {};

    // Filters based on roles
    if (req.user.role === 'Employee') {
      query.employee = req.user._id;
    } else if (req.user.role === 'Manager') {
      // Managers get their own leaves + leaves of employees reporting to them
      const reportingEmployees = await User.find({ manager: req.user._id }).select('_id');
      const empIds = reportingEmployees.map(e => e._id);
      empIds.push(req.user._id);
      query.employee = { $in: empIds };
    }
    // Admins and HR Admins can view everything

    const leaves = await LeaveApplication.find(query)
      .populate('employee', 'name email role department designation manager')
      .populate('leaveType')
      .populate('delegatedWorkTo', 'name email')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// LEAVE APPROVAL WORKFLOW
// ==========================================
const processApproval = async (req, res) => {
  const { action, comment } = req.body; // action: 'Approve', 'Reject', 'Changes_Requested'
  const leaveId = req.params.id;

  try {
    const leave = await LeaveApplication.findById(leaveId)
      .populate('employee')
      .populate('leaveType');

    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending leave applications can be approved or rejected' });
    }

    const isManager = req.user._id.toString() === leave.employee.manager?.toString();
    const isHrOrAdmin = req.user.role === 'HR Admin' || req.user.role === 'Super Admin';

    if (!isManager && !isHrOrAdmin) {
      return res.status(403).json({ message: 'Not authorized to approve/reject this leave application' });
    }

    const io = getIo(req);

    // ==========================================
    // CASE A: MANAGER APPROVES/REJECTS
    // ==========================================
    if (isManager && !isHrOrAdmin) {
      if (action === 'Approve') {
        leave.managerApproval = {
          status: 'Approved',
          comment: comment || 'Approved by Manager',
          updatedAt: new Date()
        };
        // Move to HR Stage (still pending final HR approval)
        // Note: For organizations where manager approval is final unless HR overrides,
        // we can set the state. Here we strictly implement Employee -> Manager -> HR -> Approved.
        // So manager approval shifts status to Manager_Approved internally or we keep it Pending
        // but mark managerApproval as Approved.
        
        // Notify HR Admins
        const hrs = await User.find({ role: 'HR Admin' }).select('_id');
        for (const hr of hrs) {
          await Notification.create({
            recipient: hr._id,
            title: 'Manager Approved Leave',
            message: `${leave.employee.name}'s leave approved by manager, pending HR confirmation.`,
            type: 'System'
          });
        }
      } else if (action === 'Reject') {
        leave.managerApproval = {
          status: 'Rejected',
          comment: comment || 'Rejected by Manager',
          updatedAt: new Date()
        };
        leave.status = 'Rejected'; // Short-circuit, direct rejection

        await Notification.create({
          recipient: leave.employee._id,
          title: 'Leave Rejected by Manager',
          message: `Your leave request starting ${leave.startDate.toISOString().split('T')[0]} was rejected by your manager.`,
          type: 'Rejected'
        });
      } else if (action === 'Changes_Requested') {
        leave.managerApproval = {
          status: 'Changes_Requested',
          comment: comment || 'Manager requested changes',
          updatedAt: new Date()
        };
        // Keep pending, but flag it
        await Notification.create({
          recipient: leave.employee._id,
          title: 'Changes Requested on Leave',
          message: `Your manager has requested changes for your leave starting ${leave.startDate.toISOString().split('T')[0]}. Comment: ${comment}`,
          type: 'System'
        });
      }
    }

    // ==========================================
    // CASE B: HR OR ADMIN PROCESSES / OVERRIDES
    // ==========================================
    if (isHrOrAdmin) {
      // HR overrides can approve directly, bypassing manager if needed,
      // or finalize the manager's approval.
      if (action === 'Approve') {
        leave.hrApproval = {
          status: 'Approved',
          comment: comment || 'Approved by HR',
          updatedAt: new Date()
        };
        // If HR approves, it is finalized!
        leave.status = 'Approved';

        // DEDUCT LEAVE BALANCE
        if (leave.leaveType.code !== 'LOP') {
          const balance = await EmployeeLeaveBalance.findOne({
            employee: leave.employee._id,
            leaveType: leave.leaveType._id
          });

          if (balance) {
            balance.used += leave.duration;
            balance.remaining -= leave.duration;
            balance.lastUpdated = new Date();
            await balance.save();
          }
        }

        // Notify Employee
        await Notification.create({
          recipient: leave.employee._id,
          title: 'Leave Approved',
          message: `Your leave request starting ${leave.startDate.toISOString().split('T')[0]} has been fully approved.`,
          type: 'Approved'
        });
      } else if (action === 'Reject') {
        leave.hrApproval = {
          status: 'Rejected',
          comment: comment || 'Rejected by HR',
          updatedAt: new Date()
        };
        leave.status = 'Rejected';

        await Notification.create({
          recipient: leave.employee._id,
          title: 'Leave Rejected',
          message: `Your leave request starting ${leave.startDate.toISOString().split('T')[0]} was rejected by HR.`,
          type: 'Rejected'
        });
      }
    }

    await leave.save();

    // Trigger realtime notification
    if (io) {
      io.to(leave.employee._id.toString()).emit('notification', {
        title: `Leave request ${leave.status}`,
        message: `Your leave starting ${leave.startDate.toISOString().split('T')[0]} is ${leave.status}.`
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'PROCESS_LEAVE_APPROVAL',
      details: `Processed leave ID: ${leave._id}. Action: ${action}, Final Status: ${leave.status}`,
      ipAddress: req.ip || ''
    });

    res.json(leave);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// CANCEL LEAVE (BY EMPLOYEE)
// ==========================================
const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveApplication.findById(req.params.id).populate('leaveType');

    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }

    // Only self or Admin/HR can cancel
    const isOwner = req.user._id.toString() === leave.employee.toString();
    const isHrOrAdmin = req.user.role === 'HR Admin' || req.user.role === 'Super Admin';

    if (!isOwner && !isHrOrAdmin) {
      return res.status(403).json({ message: 'Not authorized to cancel this leave application' });
    }

    if (leave.status === 'Cancelled' || leave.status === 'Rejected') {
      return res.status(400).json({ message: `Leave is already ${leave.status}` });
    }

    const previousStatus = leave.status;
    leave.status = 'Cancelled';
    await leave.save();

    // REFUND BALANCE IF PREVIOUSLY APPROVED
    if (previousStatus === 'Approved' && leave.leaveType.code !== 'LOP') {
      const balance = await EmployeeLeaveBalance.findOne({
        employee: leave.employee,
        leaveType: leave.leaveType._id
      });

      if (balance) {
        balance.used = Math.max(0, balance.used - leave.duration);
        balance.remaining = balance.remaining + leave.duration;
        balance.lastUpdated = new Date();
        await balance.save();
      }
    }

    // Notify Manager
    const employee = await User.findById(leave.employee);
    if (employee && employee.manager) {
      await Notification.create({
        recipient: employee.manager,
        title: 'Leave Cancelled',
        message: `${employee.name} cancelled their leave application from ${leave.startDate.toISOString().split('T')[0]}.`,
        type: 'Cancelled'
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'CANCEL_LEAVE',
      details: `Cancelled leave application ID: ${leave._id}. Refunded balance: ${previousStatus === 'Approved'}`,
      ipAddress: req.ip || ''
    });

    res.json({ message: 'Leave application cancelled successfully', leave });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  applyLeave,
  getMyLeaveBalances,
  getEmployeeLeaveBalances,
  getLeaves,
  processApproval,
  cancelLeave
};
