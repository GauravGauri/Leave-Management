const { EmployeeLeaveBalance, Holiday, LeavePolicy, User } = require('../models');
const { format, addDays, isWeekend, differenceInDays } = require('date-fns');

// ==========================================
// AI LEAVE RECOMMENDATION / OPTIMIZER
// ==========================================
const getLeaveRecommendations = async (req, res) => {
  try {
    const employeeId = req.user._id;

    // Fetch upcoming holidays
    const today = new Date();
    const ending = addDays(today, 90); // Look 90 days ahead
    const holidays = await Holiday.find({ date: { $gte: today, $lte: ending } }).sort({ date: 1 });

    // Fetch balances
    const balances = await EmployeeLeaveBalance.find({ employee: employeeId }).populate('leaveType');
    const remainingCL = balances.find(b => b.leaveType.code === 'CL')?.remaining || 0;
    const remainingPL = balances.find(b => b.leaveType.code === 'PL')?.remaining || 0;

    const recommendations = [];

    // Algorithmic check: Find "Bridge Leave" opportunities
    // E.g., Holiday on Tuesday -> recommend Monday. Holiday on Thursday -> recommend Friday.
    for (const holiday of holidays) {
      const holDate = new Date(holiday.date);
      const dayOfWeek = holDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat

      // Bridge Monday (Holiday is Tuesday)
      if (dayOfWeek === 2) {
        const bridgeDate = addDays(holDate, -1); // Monday
        recommendations.push({
          type: 'Bridge Weekend',
          title: `Extended Weekend for ${holiday.name}`,
          description: `Apply for leave on Monday (${format(bridgeDate, 'yyyy-MM-dd')}). The holiday is on Tuesday, giving you a continuous 4-day break from Saturday to Tuesday.`,
          dateSuggested: format(bridgeDate, 'yyyy-MM-dd'),
          estimatedDuration: 1,
          impactOnBalance: '1 Day'
        });
      }

      // Bridge Friday (Holiday is Thursday)
      if (dayOfWeek === 4) {
        const bridgeDate = addDays(holDate, 1); // Friday
        recommendations.push({
          type: 'Bridge Weekend',
          title: `Extended Weekend for ${holiday.name}`,
          description: `Apply for leave on Friday (${format(bridgeDate, 'yyyy-MM-dd')}). The holiday is on Thursday, giving you a continuous 4-day break from Thursday to Sunday.`,
          dateSuggested: format(bridgeDate, 'yyyy-MM-dd'),
          estimatedDuration: 1,
          impactOnBalance: '1 Day'
        });
      }

      // Mid-week break (Holiday is Wednesday)
      if (dayOfWeek === 3) {
        recommendations.push({
          type: 'Mid-week Recharge',
          title: `Mid-week Recharge for ${holiday.name}`,
          description: `Take two days off (Mon-Tue or Thu-Fri) around the Wednesday holiday to secure a massive 5-day vacation.`,
          dateSuggested: `${format(addDays(holDate, 1), 'yyyy-MM-dd')} & ${format(addDays(holDate, 2), 'yyyy-MM-dd')}`,
          estimatedDuration: 2,
          impactOnBalance: '2 Days'
        });
      }
    }

    // Expiry or High Balance warnings
    if (remainingCL > 8) {
      recommendations.push({
        type: 'Balance Utilization',
        title: 'Use Your Casual Leaves',
        description: `You have ${remainingCL} Casual Leaves left. Remember, Casual Leaves expire at the end of the year and cannot be fully carried forward beyond 12 days. Plan some rest!`,
        estimatedDuration: 0,
        impactOnBalance: '0 Days'
      });
    }

    if (remainingPL > 10) {
      recommendations.push({
        type: 'Encashment Opportunity',
        title: 'Privilege Leave Encashment',
        description: `Your PL balance is ${remainingPL}. You are eligible to encash these leaves or plan a longer vacation.`,
        estimatedDuration: 0,
        impactOnBalance: '0 Days'
      });
    }

    res.json(recommendations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error generating recommendations' });
  }
};

// ==========================================
// AI HR CHATBOT WITH LOCAL INTENT PARSING & GEMINI FALLBACK
// ==========================================
const chatWithAi = async (req, res) => {
  const { message } = req.body;
  const user = req.user;

  if (!message) {
    return res.status(400).json({ reply: 'Please provide a message query.' });
  }

  const cleanMsg = message.toLowerCase();

  try {
    // 1. NLP / Keyword Intent Check (Local DB queries)
    
    // INTENT A: Check Leave Balances
    if (cleanMsg.includes('balance') || cleanMsg.includes('how many leaves') || cleanMsg.includes('my leave count')) {
      const balances = await EmployeeLeaveBalance.find({ employee: user._id }).populate('leaveType');
      const balanceStrings = balances.map(b => `${b.leaveType.name} (${b.leaveType.code}): ${b.remaining} remaining (Used: ${b.used})`);
      
      return res.json({
        reply: `Hi ${user.name}! Here is your current leave balance:\n\n` + balanceStrings.join('\n') + `\n\nIs there a specific leave type you would like to apply for?`
      });
    }

    // INTENT B: Check Holidays
    if (cleanMsg.includes('holiday') || cleanMsg.includes('days off') || cleanMsg.includes('festivals')) {
      const holidays = await Holiday.find({ date: { $gte: new Date() } }).sort({ date: 1 }).limit(5);
      if (holidays.length === 0) {
        return res.json({ reply: `There are no upcoming company holidays scheduled for the rest of the year.` });
      }
      const holidayStrings = holidays.map(h => `${h.name} - ${format(h.date, 'EEEE, MMM dd, yyyy')}`);
      return res.json({
        reply: `Here are the upcoming company holidays:\n\n` + holidayStrings.join('\n') + `\n\nEnjoy planning your bridge leaves!`
      });
    }

    // INTENT C: Policy Rules check
    if (cleanMsg.includes('policy') || cleanMsg.includes('sandwich') || cleanMsg.includes('carry forward') || cleanMsg.includes('rule')) {
      const policy = await LeavePolicy.findOne({
        $or: [
          { assignedEmployees: user._id },
          { assignedDepartments: user.department?._id },
          { isDefault: true }
        ]
      }).populate('rules.leaveType');

      if (!policy) {
        return res.json({ reply: `I couldn't find a leave policy assigned to you. Please check with HR.` });
      }

      const policyDetails = policy.rules.map(r => {
        return `* **${r.leaveType.name}**: Allocation: ${r.monthlyAllocation}/mo, Carry Forward: ${r.carryForward ? 'Yes' : 'No'}, Sandwich Policy: ${r.sandwichPolicy ? 'Yes' : 'No'}, Max Consecutive: ${r.maxConsecutiveDays} days.`;
      });

      return res.json({
        reply: `You are assigned to the policy: **${policy.name}**.\nHere are the active guidelines:\n\n` + policyDetails.join('\n')
      });
    }

    // 2. Real LLM Call (Google Gemini Developer API) if API key is set
    if (process.env.GEMINI_API_KEY) {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are an HR Assistant for an enterprise company. The employee's name is ${user.name}, who is a ${user.role} in department ${user.department?.name || 'General'}.
Please answer their question briefly and professionally: "${message}"`
                }]
              }]
            })
          }
        );

        const data = await response.json();
        const geminiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (geminiReply) {
          return res.json({ reply: geminiReply });
        }
      } catch (geminiError) {
        console.error('Gemini API call failed, falling back to smart defaults:', geminiError);
      }
    }

    // 3. Fallback Smart Response
    return res.json({
      reply: `I received your message: "${message}". I can help you check your leave balance (type "check balance"), see upcoming holidays (type "holidays"), or review leave policies (type "rules"). How would you like to proceed?`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error processing chatbot query' });
  }
};

module.exports = {
  getLeaveRecommendations,
  chatWithAi
};
