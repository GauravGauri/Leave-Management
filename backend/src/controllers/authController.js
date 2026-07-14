const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'jwt_secret_dev_123', {
    expiresIn: '30d',
  });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email })
      .populate('department')
      .populate('designation')
      .populate('manager', 'name email role');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status === 'Inactive') {
      return res.status(401).json({ message: 'This account has been deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      // Log login audit
      await AuditLog.create({
        user: user._id,
        action: 'USER_LOGIN',
        details: `Successfully logged in. User email: ${email}`,
        ipAddress: req.ip || ''
      });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        manager: user.manager,
        gender: user.gender,
        avatar: user.avatar,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('department')
      .populate('designation')
      .populate('manager', 'name email role');

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        manager: user.manager,
        gender: user.gender,
        avatar: user.avatar,
        joiningDate: user.joiningDate,
        emergencyContact: user.emergencyContact
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reset password (called by Admin or self)
// @route   POST /api/auth/reset-password
// @access  Private (or Public if with reset token, here implemented as authenticated password update / admin override)
const resetPassword = async (req, res) => {
  const { userId, newPassword } = req.body;

  try {
    // If the requester is not an admin and is trying to reset someone else's password
    if (req.user.role !== 'Super Admin' && req.user.role !== 'HR Admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to perform this password reset' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'PASSWORD_RESET',
      details: `Password reset successfully for user: ${user.email}`,
      ipAddress: req.ip || ''
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  loginUser,
  getUserProfile,
  resetPassword,
};
