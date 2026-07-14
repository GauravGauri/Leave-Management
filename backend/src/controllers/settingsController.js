const { Department, Designation, Holiday, Announcement, Notification, AuditLog } = require('../models');

// ==========================================
// DEPARTMENTS
// ==========================================
const getDepartments = async (req, res) => {
  try {
    const depts = await Department.find({}).populate('manager', 'name email role');
    res.json(depts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createDepartment = async (req, res) => {
  const { name, description, manager } = req.body;
  try {
    const dept = await Department.create({ name, description, manager: manager || null });
    res.status(201).json(dept);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ message: 'Department not found' });
    dept.name = req.body.name || dept.name;
    dept.description = req.body.description || dept.description;
    dept.manager = req.body.manager !== undefined ? req.body.manager : dept.manager;
    await dept.save();
    res.json(dept);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    await Department.deleteOne({ _id: req.params.id });
    res.json({ message: 'Department deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// DESIGNATIONS
// ==========================================
const getDesignations = async (req, res) => {
  try {
    const desgs = await Designation.find({});
    res.json(desgs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createDesignation = async (req, res) => {
  const { name, description } = req.body;
  try {
    const desg = await Designation.create({ name, description });
    res.status(201).json(desg);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateDesignation = async (req, res) => {
  try {
    const desg = await Designation.findById(req.params.id);
    if (!desg) return res.status(404).json({ message: 'Designation not found' });
    desg.name = req.body.name || desg.name;
    desg.description = req.body.description || desg.description;
    await desg.save();
    res.json(desg);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteDesignation = async (req, res) => {
  try {
    await Designation.deleteOne({ _id: req.params.id });
    res.json({ message: 'Designation deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// HOLIDAYS
// ==========================================
const getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find({}).sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createHoliday = async (req, res) => {
  const { name, date, isOptional, description } = req.body;
  try {
    const holiday = await Holiday.create({ name, date: new Date(date), isOptional: !!isOptional, description });
    res.status(201).json(holiday);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    await Holiday.deleteOne({ _id: req.params.id });
    res.json({ message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// ANNOUNCEMENTS
// ==========================================
const getAnnouncements = async (req, res) => {
  try {
    const list = await Announcement.find({})
      .populate('author', 'name role')
      .populate('targetDepartments', 'name')
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createAnnouncement = async (req, res) => {
  const { title, content, targetDepartments, targetRoles } = req.body;
  try {
    const ann = await Announcement.create({
      title,
      content,
      author: req.user._id,
      targetDepartments: targetDepartments || [],
      targetRoles: targetRoles || []
    });
    res.status(201).json(ann);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    await Announcement.deleteOne({ _id: req.params.id });
    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// NOTIFICATIONS
// ==========================================
const getNotifications = async (req, res) => {
  try {
    const list = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'Notifications marked read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================================
// AUDIT LOGS
// ==========================================
const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({})
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  getHolidays,
  createHoliday,
  deleteHoliday,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getNotifications,
  markNotificationRead,
  getAuditLogs
};
