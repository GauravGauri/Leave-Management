const { Holiday, LeaveApplication, EmployeeLeaveBalance, LeavePolicy, User } = require('../models');
const { differenceInMonths, eachDayOfInterval, isWeekend, format, isSameDay } = require('date-fns');

/**
 * Calculates the calendar dates covered by a leave range, applying weekend and holiday rules.
 * Also handles the Sandwich Policy.
 * 
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {Object} rule - Policy rules for this leave type
 * @param {Array<Date>} holidayDates - Array of Holiday date objects
 * @returns {Object} { datesApplied: Array<Date>, duration: Number }
 */
function calculateLeaveDays(startDate, endDate, rule, holidayDates) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Get all calendar days in the interval
  const allDays = eachDayOfInterval({ start, end });
  const datesApplied = [];
  let duration = 0;

  const holidayStrList = holidayDates.map(d => format(new Date(d.date), 'yyyy-MM-dd'));

  for (let i = 0; i < allDays.length; i++) {
    const day = allDays[i];
    const isDayWeekend = isWeekend(day);
    const dayStr = format(day, 'yyyy-MM-dd');
    const isDayHoliday = holidayStrList.includes(dayStr);

    let countAsLeave = true;

    // Weekend rules
    if (isDayWeekend && rule.weekendRules === 'Exclude') {
      countAsLeave = false;
    }

    // Holiday rules
    if (isDayHoliday && rule.holidayRules === 'Exclude') {
      countAsLeave = false;
    }

    // Sandwich policy: If enabled, check if this weekend/holiday is "sandwiched"
    // between actual leave days in the same application.
    if (rule.sandwichPolicy && (isDayWeekend || isDayHoliday)) {
      // It is sandwiched if there's at least one counted leave day before it and one after it
      let activeBefore = false;
      let activeAfter = false;

      // Check days before
      for (let j = 0; j < i; j++) {
        const prevDay = allDays[j];
        const prevIsWeekend = isWeekend(prevDay);
        const prevIsHoliday = holidayStrList.includes(format(prevDay, 'yyyy-MM-dd'));
        const prevWeekendExclude = prevIsWeekend && rule.weekendRules === 'Exclude';
        const prevHolidayExclude = prevIsHoliday && rule.holidayRules === 'Exclude';
        if (!prevWeekendExclude && !prevHolidayExclude) {
          activeBefore = true;
          break;
        }
      }

      // Check days after
      for (let j = i + 1; j < allDays.length; j++) {
        const nextDay = allDays[j];
        const nextIsWeekend = isWeekend(nextDay);
        const nextIsHoliday = holidayStrList.includes(format(nextDay, 'yyyy-MM-dd'));
        const nextWeekendExclude = nextIsWeekend && rule.weekendRules === 'Exclude';
        const nextHolidayExclude = nextIsHoliday && rule.holidayRules === 'Exclude';
        if (!nextWeekendExclude && !nextHolidayExclude) {
          activeAfter = true;
          break;
        }
      }

      if (activeBefore && activeAfter) {
        countAsLeave = true;
      }
    }

    if (countAsLeave) {
      datesApplied.push(day);
      duration += 1;
    }
  }

  return { datesApplied, duration };
}

/**
 * Validates a leave application request against the policy and active leave balance.
 * 
 * @param {Object} employeeId 
 * @param {Object} leaveTypeId 
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {Boolean} isHalfDay 
 * @param {String} halfDaySession 
 * @param {String} medicalCertificateUrl 
 * @returns {Object} { isValid: Boolean, message: String, datesApplied: Array<Date>, duration: Number }
 */
async function validateLeaveApplication(employeeId, leaveTypeId, startDate, endDate, isHalfDay, halfDaySession, medicalCertificateUrl) {
  // 1. Fetch user and check manager
  const user = await User.findById(employeeId).populate('department');
  if (!user) {
    return { isValid: false, message: 'Employee not found' };
  }

  if (!user.manager && user.role !== 'Super Admin') {
    return { isValid: false, message: 'Reporting Manager is not assigned. Please contact HR to assign a manager.' };
  }

  // 2. Fetch active policy for user
  const policy = await LeavePolicy.findOne({
    $or: [
      { assignedEmployees: employeeId },
      { assignedDepartments: user.department ? user.department._id : null },
      { isDefault: true }
    ]
  }).populate('rules.leaveType');

  if (!policy) {
    return { isValid: false, message: 'No leave policy assigned to employee or department' };
  }

  // Find the specific rule for this leave type
  const rule = policy.rules.find(r => r.leaveType._id.toString() === leaveTypeId.toString());
  if (!rule) {
    return { isValid: false, message: 'Leave type is not configured under the employee\'s policy' };
  }

  const leaveType = rule.leaveType;

  // 3. Gender restrictions
  if (rule.genderRestriction !== 'All' && user.gender !== rule.genderRestriction) {
    return { isValid: false, message: `This leave type is only available for ${rule.genderRestriction} employees` };
  }

  // 4. Department restrictions
  if (rule.departmentRestriction && rule.departmentRestriction.length > 0) {
    const isDeptAllowed = rule.departmentRestriction.some(
      deptId => user.department && user.department._id.toString() === deptId.toString()
    );
    if (!isDeptAllowed) {
      return { isValid: false, message: 'Your department is restricted from applying for this leave type' };
    }
  }

  // 5. Minimum Service Duration
  const serviceDurationMonths = differenceInMonths(new Date(startDate), new Date(user.joiningDate));
  if (serviceDurationMonths < rule.minServiceDurationMonths) {
    return { 
      isValid: false, 
      message: `Minimum service of ${rule.minServiceDurationMonths} months required. You have only served ${serviceDurationMonths} months.` 
    };
  }

  // 6. Calculate Duration and Dates
  let datesApplied = [];
  let duration = 0;

  if (isHalfDay) {
    // Half day check
    if (!rule.halfDayAllowed) {
      return { isValid: false, message: 'Half day leaves are not allowed for this leave type' };
    }
    if (!isSameDay(new Date(startDate), new Date(endDate))) {
      return { isValid: false, message: 'Half day leave must be on the same start and end date' };
    }
    if (halfDaySession === 'None') {
      return { isValid: false, message: 'Please select a half day session (Morning or Afternoon)' };
    }

    // Verify if it's a holiday or weekend (exclude half days on non-working days)
    const holidays = await Holiday.find({});
    const isDayWeekend = isWeekend(new Date(startDate));
    const dayStr = format(new Date(startDate), 'yyyy-MM-dd');
    const isDayHoliday = holidays.some(h => format(new Date(h.date), 'yyyy-MM-dd') === dayStr);

    if (isDayWeekend && rule.weekendRules === 'Exclude') {
      return { isValid: false, message: 'Cannot apply half day leave on a weekend' };
    }
    if (isDayHoliday && rule.holidayRules === 'Exclude') {
      return { isValid: false, message: 'Cannot apply half day leave on a holiday' };
    }

    datesApplied = [new Date(startDate)];
    duration = 0.5;
  } else {
    // Full day range
    const holidays = await Holiday.find({});
    const calculations = calculateLeaveDays(startDate, endDate, rule, holidays);
    datesApplied = calculations.datesApplied;
    duration = calculations.duration;

    if (duration === 0) {
      return { isValid: false, message: 'Selected date range contains only non-working days (weekends/holidays)' };
    }
  }

  // 7. Maximum Consecutive Days
  if (duration > rule.maxConsecutiveDays) {
    return { isValid: false, message: `Maximum consecutive days allowed is ${rule.maxConsecutiveDays}. You requested ${duration} days.` };
  }

  // 8. Medical Certificate check
  if (rule.requiresMedicalCertificate && duration >= rule.minConsecutiveDaysForMedical) {
    if (!medicalCertificateUrl) {
      return { 
        isValid: false, 
        message: `Medical certificate is required for leaves of ${rule.minConsecutiveDaysForMedical} or more consecutive days.` 
      };
    }
  }

  // 9. Overlapping leaves check
  const overlappingLeave = await LeaveApplication.findOne({
    employee: employeeId,
    status: { $in: ['Pending', 'Approved'] },
    datesApplied: { $in: datesApplied }
  });

  if (overlappingLeave) {
    return { 
      isValid: false, 
      message: `You have an overlapping leave application (${overlappingLeave.status}) during this period` 
    };
  }

  // 10. Balance check
  // LOP (Loss of Pay) typically is unlimited and doesn't require checking balance
  if (leaveType.code !== 'LOP') {
    const balance = await EmployeeLeaveBalance.findOne({
      employee: employeeId,
      leaveType: leaveTypeId
    });

    if (!balance || balance.remaining < duration) {
      return { 
        isValid: false, 
        message: `Insufficient leave balance. Required: ${duration}, Available: ${balance ? balance.remaining : 0}` 
      };
    }
  }

  return {
    isValid: true,
    message: 'Leave application is valid',
    datesApplied,
    duration
  };
}

module.exports = {
  calculateLeaveDays,
  validateLeaveApplication
};
