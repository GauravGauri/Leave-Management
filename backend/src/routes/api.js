const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Import controllers
const { loginUser, getUserProfile, resetPassword } = require('../controllers/authController');
const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  importEmployeesFromExcel
} = require('../controllers/employeeController');
const {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getLeavePolicies,
  getLeavePolicyById,
  createLeavePolicy,
  updateLeavePolicy,
  deleteLeavePolicy
} = require('../controllers/policyController');
const {
  applyLeave,
  getMyLeaveBalances,
  getEmployeeLeaveBalances,
  getLeaves,
  processApproval,
  cancelLeave
} = require('../controllers/leaveController');
const {
  getReportSummary,
  exportExcelReport,
  exportPdfReport
} = require('../controllers/reportController');
const {
  getAdminDashboardStats,
  getEmployeeDashboardStats
} = require('../controllers/dashboardController');
const {
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
} = require('../controllers/settingsController');
const { getLeaveRecommendations, chatWithAi } = require('../controllers/aiController');

// Import middlewares
const { protect, authorize } = require('../middleware/auth');

// ==========================================
// AUTH MODULE
// ==========================================
router.post('/auth/login', loginUser);
router.get('/auth/profile', protect, getUserProfile);
router.post('/auth/reset-password', protect, resetPassword);

// ==========================================
// EMPLOYEE MODULE
// ==========================================
router.post('/employees', protect, authorize('Super Admin', 'HR Admin'), createEmployee);
router.get('/employees', protect, authorize('Super Admin', 'HR Admin', 'Manager'), getEmployees);
router.post('/employees/import', protect, authorize('Super Admin', 'HR Admin'), upload.single('file'), importEmployeesFromExcel);
router.get('/employees/:id', protect, getEmployeeById);
router.put('/employees/:id', protect, updateEmployee);
router.delete('/employees/:id', protect, authorize('Super Admin'), deleteEmployee);

// ==========================================
// POLICY CONFIGURATION MODULE
// ==========================================
router.get('/policies/types', protect, getLeaveTypes);
router.post('/policies/types', protect, authorize('Super Admin', 'HR Admin'), createLeaveType);
router.put('/policies/types/:id', protect, authorize('Super Admin', 'HR Admin'), updateLeaveType);
router.delete('/policies/types/:id', protect, authorize('Super Admin', 'HR Admin'), deleteLeaveType);

router.get('/policies', protect, getLeavePolicies);
router.post('/policies', protect, authorize('Super Admin', 'HR Admin'), createLeavePolicy);
router.get('/policies/:id', protect, getLeavePolicyById);
router.put('/policies/:id', protect, authorize('Super Admin', 'HR Admin'), updateLeavePolicy);
router.delete('/policies/:id', protect, authorize('Super Admin'), deleteLeavePolicy);

// ==========================================
// LEAVE APPLICATIONS & WORKFLOW
// ==========================================
router.post('/leaves', protect, upload.single('file'), applyLeave);
router.get('/leaves/balance', protect, getMyLeaveBalances);
router.get('/leaves/balance/:id', protect, getEmployeeLeaveBalances);
router.get('/leaves/history', protect, getLeaves);
router.post('/leaves/:id/approval', protect, processApproval);
router.post('/leaves/:id/cancel', protect, cancelLeave);

// ==========================================
// REPORTS MODULE
// ==========================================
router.get('/reports', protect, authorize('Super Admin', 'HR Admin', 'Manager'), getReportSummary);
router.get('/reports/export/excel', protect, authorize('Super Admin', 'HR Admin', 'Manager'), exportExcelReport);
router.get('/reports/export/pdf', protect, authorize('Super Admin', 'HR Admin', 'Manager'), exportPdfReport);

// ==========================================
// DASHBOARDS MODULE
// ==========================================
router.get('/dashboard/admin', protect, authorize('Super Admin', 'HR Admin'), getAdminDashboardStats);
router.get('/dashboard/employee', protect, getEmployeeDashboardStats);

// ==========================================
// SETTINGS, METADATA & UTILITIES
// ==========================================
router.get('/settings/departments', protect, getDepartments);
router.post('/settings/departments', protect, authorize('Super Admin', 'HR Admin'), createDepartment);
router.put('/settings/departments/:id', protect, authorize('Super Admin', 'HR Admin'), updateDepartment);
router.delete('/settings/departments/:id', protect, authorize('Super Admin'), deleteDepartment);

router.get('/settings/designations', protect, getDesignations);
router.post('/settings/designations', protect, authorize('Super Admin', 'HR Admin'), createDesignation);
router.put('/settings/designations/:id', protect, authorize('Super Admin', 'HR Admin'), updateDesignation);
router.delete('/settings/designations/:id', protect, authorize('Super Admin'), deleteDesignation);

router.get('/settings/holidays', protect, getHolidays);
router.post('/settings/holidays', protect, authorize('Super Admin', 'HR Admin'), createHoliday);
router.delete('/settings/holidays/:id', protect, authorize('Super Admin'), deleteHoliday);

router.get('/settings/announcements', protect, getAnnouncements);
router.post('/settings/announcements', protect, authorize('Super Admin', 'HR Admin'), createAnnouncement);
router.delete('/settings/announcements/:id', protect, authorize('Super Admin'), deleteAnnouncement);

router.get('/settings/notifications', protect, getNotifications);
router.post('/settings/notifications/read', protect, markNotificationRead);

router.get('/settings/audit-logs', protect, authorize('Super Admin'), getAuditLogs);

// ==========================================
// AI COMPONENT MODULE
// ==========================================
router.get('/ai/recommend-leaves', protect, getLeaveRecommendations);
router.post('/ai/chatbot', protect, chatWithAi);

module.exports = router;
