const cron = require('node-cron');
const { User, LeavePolicy, EmployeeLeaveBalance, Notification, AuditLog } = require('../models');

/**
 * Performs monthly leave credit calculation and update for all active employees.
 */
async function runMonthlyAllocation() {
  console.log('[Cron] Starting monthly leave allocation process...');
  try {
    const activeEmployees = await User.find({ status: 'Active' }).populate('department');
    console.log(`[Cron] Found ${activeEmployees.length} active employees to process.`);

    for (const employee of activeEmployees) {
      // Find the policy for this employee
      const policy = await LeavePolicy.findOne({
        $or: [
          { assignedEmployees: employee._id },
          { assignedDepartments: employee.department ? employee.department._id : null },
          { isDefault: true }
        ]
      }).populate('rules.leaveType');

      if (!policy) {
        console.warn(`[Cron] No policy found for employee ${employee.email}. Skipping.`);
        continue;
      }

      for (const rule of policy.rules) {
        const leaveType = rule.leaveType;
        if (!leaveType) continue;

        // Skip Loss of Pay or unlimited leave types from auto-crediting if needed,
        // but normally LOP is 0 allocation and unlimited. We process it as configured.
        let balance = await EmployeeLeaveBalance.findOne({
          employee: employee._id,
          leaveType: leaveType._id
        });

        if (!balance) {
          balance = new EmployeeLeaveBalance({
            employee: employee._id,
            leaveType: leaveType._id,
            available: 0,
            used: 0,
            remaining: 0,
            carryForwarded: 0,
            creditedThisMonth: 0
          });
        }

        const currentRemaining = balance.remaining;
        let newRemaining = 0;
        let carryForwardAmount = 0;

        if (rule.carryForward) {
          // Carry Forward is enabled: Add monthly allocation to existing balance
          // Cap the total remaining by the maxCarryForward (or yearly limit if applicable)
          const potentialNewRemaining = currentRemaining + rule.monthlyAllocation;
          
          if (rule.maxCarryForward > 0 && potentialNewRemaining > rule.maxCarryForward) {
            newRemaining = rule.maxCarryForward;
            carryForwardAmount = rule.maxCarryForward - rule.monthlyAllocation;
          } else {
            newRemaining = potentialNewRemaining;
            carryForwardAmount = currentRemaining;
          }
        } else {
          // Carry Forward is disabled: reset and credit only monthly allocation
          newRemaining = rule.monthlyAllocation;
          carryForwardAmount = 0;
        }

        // Set variables
        balance.carryForwarded = carryForwardAmount;
        balance.creditedThisMonth = rule.monthlyAllocation;
        // Total available is accumulated or reset
        balance.available = balance.used + newRemaining;
        balance.remaining = newRemaining;
        balance.lastUpdated = new Date();

        await balance.save();

        // Create in-app notification for credit
        if (rule.monthlyAllocation > 0) {
          await Notification.create({
            recipient: employee._id,
            title: 'Monthly Leave Credited',
            message: `Your balance for ${leaveType.name} (${leaveType.code}) has been updated. ${rule.monthlyAllocation} days credited. New balance: ${newRemaining}.`,
            type: 'Credit'
          });
        }
      }

      // Log audit
      await AuditLog.create({
        user: null, // System actions
        action: 'MONTHLY_LEAVE_CREDIT',
        details: `Automatically credited monthly leaves for user: ${employee.email} based on policy "${policy.name}"`
      });
    }

    console.log('[Cron] Monthly leave allocation completed successfully.');
  } catch (error) {
    console.error('[Cron] Error running monthly leave allocation:', error);
  }
}

// Schedule the cron job to run at 00:00 on the 1st day of every month
const startCronJobs = () => {
  cron.schedule('0 0 1 * *', async () => {
    await runMonthlyAllocation();
  });
  console.log('[Cron] Monthly allocation cron job scheduled.');
};

module.exports = {
  startCronJobs,
  runMonthlyAllocation // Exported to allow manual triggers or testing
};
