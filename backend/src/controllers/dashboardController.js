const { User, LeaveApplication, EmployeeLeaveBalance, Holiday, Announcement, Department } = require('../models');

// @desc    Get Admin Dashboard Stats
// @route   GET /api/dashboard/admin
// @access  Private (Admin/HR Only)
const getAdminDashboardStats = async (req, res) => {
  try {
    const totalEmployees = await User.countDocuments({ status: 'Active' });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Leaves active today
    const leavesToday = await LeaveApplication.countDocuments({
      status: 'Approved',
      datesApplied: { $in: [today] }
    });

    const pendingApprovals = await LeaveApplication.countDocuments({
      status: 'Pending'
    });

    // Chart 1: Leave usage by Leave Type (aggregation)
    const typeUsage = await LeaveApplication.aggregate([
      { $match: { status: 'Approved' } },
      { $group: { _id: '$leaveType', totalDays: { $sum: '$duration' } } }
    ]);
    
    // We populate LeaveType manually since aggregate doesn't run Mongoose middleware
    const leavesPopulated = await LeaveApplication.populate(typeUsage, { path: '_id', model: 'LeaveType' });
    const leaveTypeChart = leavesPopulated.map(item => ({
      name: item._id ? item._id.name : 'Unknown',
      value: item.totalDays
    }));

    // Chart 2: Monthly Leave Usage
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyUsage = await LeaveApplication.aggregate([
      { 
        $match: { 
          status: 'Approved',
          startDate: { $gte: sixMonthsAgo }
        } 
      },
      {
        $group: {
          _id: { month: { $month: '$startDate' }, year: { $year: '$startDate' } },
          count: { $sum: '$duration' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyChart = monthlyUsage.map(item => ({
      month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      leaves: item.count
    }));

    // List of today's active leaves
    const todayLeavesList = await LeaveApplication.find({
      status: 'Approved',
      datesApplied: { $in: [today] }
    }).populate('employee', 'name email department').populate('leaveType');

    // List of pending approvals
    const pendingList = await LeaveApplication.find({
      status: 'Pending'
    })
      .populate('employee', 'name email role department manager')
      .populate('leaveType')
      .limit(5);

    res.json({
      stats: {
        totalEmployees,
        leavesToday,
        pendingApprovals
      },
      charts: {
        leaveTypeChart,
        monthlyChart
      },
      todayLeavesList,
      pendingList
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching admin dashboard stats' });
  }
};

// @desc    Get Employee Dashboard Stats
// @route   GET /api/dashboard/employee
// @access  Private (Employee/All)
const getEmployeeDashboardStats = async (req, res) => {
  const employeeId = req.user._id;
  try {
    // 1. Leave Balances
    const balances = await EmployeeLeaveBalance.find({ employee: employeeId })
      .populate('leaveType');

    const formattedBalances = balances.map(b => ({
      code: b.leaveType.code,
      name: b.leaveType.name,
      available: b.available,
      used: b.used,
      remaining: b.remaining
    }));

    // 2. Pending applications
    const pendingCount = await LeaveApplication.countDocuments({ employee: employeeId, status: 'Pending' });
    const approvedCount = await LeaveApplication.countDocuments({ employee: employeeId, status: 'Approved' });
    const rejectedCount = await LeaveApplication.countDocuments({ employee: employeeId, status: 'Rejected' });

    const recentApplications = await LeaveApplication.find({ employee: employeeId })
      .populate('leaveType')
      .sort({ createdAt: -1 })
      .limit(5);

    // 3. Upcoming Holidays
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingHolidays = await Holiday.find({ date: { $gte: today } })
      .sort({ date: 1 })
      .limit(5);

    // 4. Announcements
    const announcements = await Announcement.find({
      $or: [
        { targetDepartments: req.user.department?._id },
        { targetDepartments: { $exists: true, $size: 0 } }
      ],
      $or: [
        { targetRoles: req.user.role },
        { targetRoles: { $exists: true, $size: 0 } }
      ]
    })
      .populate('author', 'name role')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      balances: formattedBalances,
      stats: {
        pendingCount,
        approvedCount,
        rejectedCount
      },
      recentApplications,
      upcomingHolidays,
      announcements
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching employee dashboard stats' });
  }
};

module.exports = {
  getAdminDashboardStats,
  getEmployeeDashboardStats
};
