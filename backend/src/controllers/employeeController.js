const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { User, Department, Designation, EmployeeLeaveBalance, LeavePolicy, AuditLog } = require('../models');

// @desc    Create a new employee
// @route   POST /api/employees
// @access  Private (Admin/HR Only)
const createEmployee = async (req, res) => {
  const { name, email, password, role, department, designation, manager, gender, joiningDate, emergencyContact } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'Welcome@123', salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'Employee',
      department: department || null,
      designation: designation || null,
      manager: manager || null,
      gender,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      emergencyContact: emergencyContact || {}
    });

    // Initialize Employee Leave Balance based on active Leave Policy
    const policy = await LeavePolicy.findOne({
      $or: [
        { assignedEmployees: user._id },
        { assignedDepartments: user.department },
        { isDefault: true }
      ]
    }).populate('rules.leaveType');

    if (policy) {
      for (const rule of policy.rules) {
        if (!rule.leaveType) continue;
        await EmployeeLeaveBalance.create({
          employee: user._id,
          leaveType: rule.leaveType._id,
          available: rule.monthlyAllocation, // Initial month credit
          used: 0,
          remaining: rule.monthlyAllocation,
          carryForwarded: 0,
          creditedThisMonth: rule.monthlyAllocation
        });
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_EMPLOYEE',
      details: `Created new employee: ${user.email} with role: ${user.role}`,
      ipAddress: req.ip || ''
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      designation: user.designation,
      manager: user.manager,
      status: user.status
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private (Admin/HR/Managers)
const getEmployees = async (req, res) => {
  try {
    const employees = await User.find({})
      .populate('department')
      .populate('designation')
      .populate('manager', 'name email role')
      .select('-password');
    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get employee by ID
// @route   GET /api/employees/:id
// @access  Private
const getEmployeeById = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id)
      .populate('department')
      .populate('designation')
      .populate('manager', 'name email role')
      .select('-password');

    if (employee) {
      res.json(employee);
    } else {
      res.status(404).json({ message: 'Employee not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (Admin/HR or Self update restricted)
const updateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Role restrictions
    if (req.user.role !== 'Super Admin' && req.user.role !== 'HR Admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    // Update details
    employee.name = req.body.name || employee.name;
    employee.gender = req.body.gender || employee.gender;
    employee.emergencyContact = req.body.emergencyContact || employee.emergencyContact;
    employee.avatar = req.body.avatar || employee.avatar;

    // Admin/HR fields
    if (req.user.role === 'Super Admin' || req.user.role === 'HR Admin') {
      employee.role = req.body.role || employee.role;
      employee.department = req.body.department !== undefined ? req.body.department : employee.department;
      employee.designation = req.body.designation !== undefined ? req.body.designation : employee.designation;
      employee.manager = req.body.manager !== undefined ? req.body.manager : employee.manager;
      employee.status = req.body.status || employee.status;
      employee.joiningDate = req.body.joiningDate || employee.joiningDate;
    }

    const updatedEmployee = await employee.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_EMPLOYEE',
      details: `Updated details for employee: ${employee.email}`,
      ipAddress: req.ip || ''
    });

    res.json({
      _id: updatedEmployee._id,
      name: updatedEmployee.name,
      email: updatedEmployee.email,
      role: updatedEmployee.role,
      status: updatedEmployee.status,
      department: updatedEmployee.department,
      designation: updatedEmployee.designation,
      manager: updatedEmployee.manager
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete employee (hard delete)
// @route   DELETE /api/employees/:id
// @access  Private (Admin Only)
const deleteEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await User.deleteOne({ _id: req.params.id });
    await EmployeeLeaveBalance.deleteMany({ employee: req.params.id });

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_EMPLOYEE',
      details: `Deleted employee record and balances for: ${employee.email}`,
      ipAddress: req.ip || ''
    });

    res.json({ message: 'Employee and their balances deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Import employees from Excel
// @route   POST /api/employees/import
// @access  Private (Admin/HR Only)
const importEmployeesFromExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an Excel file' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    const employeesCreated = [];
    const errors = [];
    const salt = await bcrypt.genSalt(10);

    // Row loop starts at 2 to skip headers
    // Columns layout expected:
    // A: Name, B: Email, C: Password, D: Role, E: Gender, F: Department, G: Designation, H: Manager Email, I: Joining Date (YYYY-MM-DD)
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const name = row.getCell(1).text.trim();
      const email = row.getCell(2).text.trim();
      const password = row.getCell(3).text.trim();
      const role = row.getCell(4).text.trim();
      const gender = row.getCell(5).text.trim();
      const departmentName = row.getCell(6).text.trim();
      const designationName = row.getCell(7).text.trim();
      const managerEmail = row.getCell(8).text.trim();
      const joiningDateVal = row.getCell(9).text.trim();

      if (!name || !email || !gender) {
        continue; // Skip empty rows or incomplete records
      }

      // Check duplicate
      const userExists = await User.findOne({ email });
      if (userExists) {
        errors.push(`Row ${rowNumber}: Email ${email} already exists`);
        continue;
      }

      // Resolve department
      let departmentId = null;
      if (departmentName) {
        let dept = await Department.findOne({ name: departmentName });
        if (!dept) {
          dept = await Department.create({ name: departmentName, description: 'Imported via excel' });
        }
        departmentId = dept._id;
      }

      // Resolve designation
      let designationId = null;
      if (designationName) {
        let desg = await Designation.findOne({ name: designationName });
        if (!desg) {
          desg = await Designation.create({ name: designationName, description: 'Imported via excel' });
        }
        designationId = desg._id;
      }

      // Resolve manager
      let managerId = null;
      if (managerEmail) {
        const mgr = await User.findOne({ email: managerEmail });
        if (mgr) {
          managerId = mgr._id;
        } else {
          errors.push(`Row ${rowNumber}: Manager with email ${managerEmail} not found. Manager will be set to null.`);
        }
      }

      const hashedPassword = await bcrypt.hash(password || 'Welcome@123', salt);

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: role || 'Employee',
        gender: gender || 'Other',
        department: departmentId,
        designation: designationId,
        manager: managerId,
        joiningDate: joiningDateVal ? new Date(joiningDateVal) : new Date(),
        status: 'Active'
      });

      // Initialize Leave Balances
      const policy = await LeavePolicy.findOne({
        $or: [
          { assignedEmployees: user._id },
          { assignedDepartments: user.department },
          { isDefault: true }
        ]
      }).populate('rules.leaveType');

      if (policy) {
        for (const rule of policy.rules) {
          if (!rule.leaveType) continue;
          await EmployeeLeaveBalance.create({
            employee: user._id,
            leaveType: rule.leaveType._id,
            available: rule.monthlyAllocation,
            used: 0,
            remaining: rule.monthlyAllocation,
            carryForwarded: 0,
            creditedThisMonth: rule.monthlyAllocation
          });
        }
      }

      employeesCreated.push(user.email);
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'IMPORT_EMPLOYEES',
      details: `Imported ${employeesCreated.length} employees from Excel. Failures/Warnings: ${errors.length}`,
      ipAddress: req.ip || ''
    });

    res.json({
      message: `Successfully imported ${employeesCreated.length} employees.`,
      errors,
      importedEmails: employeesCreated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Excel import error' });
  }
};

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  importEmployeesFromExcel
};
