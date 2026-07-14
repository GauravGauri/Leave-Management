const { LeaveType, LeavePolicy, EmployeeLeaveBalance, User } = require('../models');

// ==========================================
// LEAVE TYPE CONTROLLERS
// ==========================================

const getLeaveTypes = async (req, res) => {
  try {
    const leaveTypes = await LeaveType.find({});
    res.json(leaveTypes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createLeaveType = async (req, res) => {
  const { name, code, description } = req.body;
  try {
    const exists = await LeaveType.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: `Leave type with code ${code} already exists` });
    }
    const leaveType = await LeaveType.create({
      name,
      code: code.toUpperCase(),
      description
    });
    res.status(201).json(leaveType);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateLeaveType = async (req, res) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }
    leaveType.name = req.body.name || leaveType.name;
    leaveType.description = req.body.description || leaveType.description;
    const updated = await leaveType.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteLeaveType = async (req, res) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }
    await LeaveType.deleteOne({ _id: req.params.id });
    res.json({ message: 'Leave type deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// LEAVE POLICY CONTROLLERS
// ==========================================

const getLeavePolicies = async (req, res) => {
  try {
    const policies = await LeavePolicy.find({})
      .populate('rules.leaveType')
      .populate('assignedEmployees', 'name email role')
      .populate('assignedDepartments', 'name');
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getLeavePolicyById = async (req, res) => {
  try {
    const policy = await LeavePolicy.findById(req.params.id)
      .populate('rules.leaveType')
      .populate('assignedEmployees', 'name email role')
      .populate('assignedDepartments', 'name');
    if (!policy) {
      return res.status(404).json({ message: 'Leave policy not found' });
    }
    res.json(policy);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createLeavePolicy = async (req, res) => {
  const { name, description, isDefault, rules, assignedEmployees, assignedDepartments } = req.body;
  try {
    const exists = await LeavePolicy.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: `Leave policy ${name} already exists` });
    }

    if (isDefault) {
      // Unset previous defaults
      await LeavePolicy.updateMany({ isDefault: true }, { isDefault: false });
    }

    const policy = await LeavePolicy.create({
      name,
      description,
      isDefault: !!isDefault,
      rules: rules || [],
      assignedEmployees: assignedEmployees || [],
      assignedDepartments: assignedDepartments || []
    });

    // Populate rule leaveType before returning
    const populatedPolicy = await LeavePolicy.findById(policy._id).populate('rules.leaveType');

    // Automatically align balances for newly assigned employees or departments
    await alignBalancesForPolicy(populatedPolicy);

    res.status(201).json(populatedPolicy);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateLeavePolicy = async (req, res) => {
  try {
    const policy = await LeavePolicy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: 'Leave policy not found' });
    }

    if (req.body.isDefault) {
      await LeavePolicy.updateMany({ _id: { $ne: policy._id }, isDefault: true }, { isDefault: false });
    }

    policy.name = req.body.name || policy.name;
    policy.description = req.body.description || policy.description;
    policy.isDefault = req.body.isDefault !== undefined ? !!req.body.isDefault : policy.isDefault;
    policy.rules = req.body.rules || policy.rules;
    policy.assignedEmployees = req.body.assignedEmployees || policy.assignedEmployees;
    policy.assignedDepartments = req.body.assignedDepartments || policy.assignedDepartments;

    const updated = await policy.save();
    const populated = await LeavePolicy.findById(updated._id).populate('rules.leaveType');

    // Recalculate/align balances for employees covered under this policy
    await alignBalancesForPolicy(populated);

    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteLeavePolicy = async (req, res) => {
  try {
    const policy = await LeavePolicy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: 'Leave policy not found' });
    }

    if (policy.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default leave policy. Designate another default first.' });
    }

    await LeavePolicy.deleteOne({ _id: req.params.id });
    res.json({ message: 'Leave policy deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// UTILITY: ALIGN EMPLOYEE BALANCES
// ==========================================
async function alignBalancesForPolicy(policy) {
  try {
    // 1. Identify users affected by this policy
    // Users with direct assignment or user whose department is assigned
    let query = { status: 'Active' };
    if (policy.isDefault) {
      // Default policy affects everyone unless they have custom override
      // So let's run balance verification for everyone
    } else {
      query.$or = [
        { _id: { $in: policy.assignedEmployees } },
        { department: { $in: policy.assignedDepartments } }
      ];
    }

    const employees = await User.find(query);

    for (const employee of employees) {
      // Verify that this policy is indeed the best matching policy for the employee
      // (a direct assignment overrides department assignment, which overrides default)
      const bestPolicy = await LeavePolicy.findOne({
        $or: [
          { assignedEmployees: employee._id },
          { assignedDepartments: employee.department || null },
          { isDefault: true }
        ]
      });

      if (!bestPolicy || bestPolicy._id.toString() !== policy._id.toString()) {
        continue; // This employee is covered by a more specific policy
      }

      for (const rule of policy.rules) {
        if (!rule.leaveType) continue;

        let balance = await EmployeeLeaveBalance.findOne({
          employee: employee._id,
          leaveType: rule.leaveType
        });

        if (!balance) {
          // If no balance exists, create one with standard monthly credit
          await EmployeeLeaveBalance.create({
            employee: employee._id,
            leaveType: rule.leaveType,
            available: rule.monthlyAllocation,
            used: 0,
            remaining: rule.monthlyAllocation,
            carryForwarded: 0,
            creditedThisMonth: rule.monthlyAllocation
          });
        }
        // We do not overwrite active balances to prevent resetting users' accumulated leaves,
        // but we ensure the balance record exists.
      }
    }
  } catch (error) {
    console.error('Error aligning balances:', error);
  }
}

module.exports = {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getLeavePolicies,
  getLeavePolicyById,
  createLeavePolicy,
  updateLeavePolicy,
  deleteLeavePolicy
};
