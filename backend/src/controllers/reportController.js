const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { User, Department, LeaveApplication, EmployeeLeaveBalance, LeaveType } = require('../models');

// ==========================================
// UTILITY: GET REPORT DATA
// ==========================================
async function fetchReportData(type, filters = {}) {
  const { departmentId, startDate, endDate, employeeId } = filters;
  
  let userQuery = { status: 'Active' };
  if (departmentId) userQuery.department = departmentId;
  if (employeeId) userQuery._id = employeeId;

  const employees = await User.find(userQuery)
    .populate('department')
    .populate('designation')
    .select('name email department designation');

  const empIds = employees.map(e => e._id);

  let leaveQuery = { employee: { $in: empIds } };
  if (startDate && endDate) {
    leaveQuery.startDate = { $gte: new Date(startDate) };
    leaveQuery.endDate = { $lte: new Date(endDate) };
  }

  const leaves = await LeaveApplication.find(leaveQuery)
    .populate('employee')
    .populate('leaveType');

  const balances = await EmployeeLeaveBalance.find({ employee: { $in: empIds } })
    .populate('employee')
    .populate('leaveType');

  if (type === 'balance') {
    // Return structured balance grid
    return employees.map(emp => {
      const empBalances = balances.filter(b => b.employee._id.toString() === emp._id.toString());
      const row = {
        name: emp.name,
        email: emp.email,
        department: emp.department?.name || 'N/A',
        designation: emp.designation?.name || 'N/A'
      };
      empBalances.forEach(b => {
        row[b.leaveType.code] = b.remaining;
      });
      return row;
    });
  }

  if (type === 'utilization') {
    // Calculate leave utilization rate
    return employees.map(emp => {
      const empBalances = balances.filter(b => b.employee._id.toString() === emp._id.toString());
      const totalAvailable = empBalances.reduce((acc, b) => acc + b.available, 0);
      const totalUsed = empBalances.reduce((acc, b) => acc + b.used, 0);
      const rate = totalAvailable > 0 ? (totalUsed / totalAvailable) * 100 : 0;

      return {
        name: emp.name,
        email: emp.email,
        department: emp.department?.name || 'N/A',
        totalAvailable,
        totalUsed,
        utilizationRate: `${rate.toFixed(1)}%`
      };
    });
  }

  if (type === 'wfh') {
    // Work From Home report
    const wfhLeaves = leaves.filter(l => l.leaveType.code === 'WFH');
    return wfhLeaves.map(l => ({
      name: l.employee.name,
      department: l.employee.department?.name || 'N/A',
      startDate: l.startDate.toISOString().split('T')[0],
      endDate: l.endDate.toISOString().split('T')[0],
      duration: l.duration,
      status: l.status,
      reason: l.reason
    }));
  }

  // Default: Return Leave transaction list
  return leaves.map(l => ({
    name: l.employee.name,
    email: l.employee.email,
    department: l.employee.department?.name || 'N/A',
    leaveType: l.leaveType.name,
    startDate: l.startDate.toISOString().split('T')[0],
    endDate: l.endDate.toISOString().split('T')[0],
    duration: l.duration,
    status: l.status,
    reason: l.reason
  }));
}

// ==========================================
// API ENDPOINT FOR REPORT SUMMARY
// ==========================================
const getReportSummary = async (req, res) => {
  const { type, departmentId, startDate, endDate, employeeId } = req.query;
  try {
    const data = await fetchReportData(type, { departmentId, startDate, endDate, employeeId });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching reports' });
  }
};

// ==========================================
// EXPORT EXCEL
// ==========================================
const exportExcelReport = async (req, res) => {
  const { type, departmentId, startDate, endDate, employeeId } = req.query;

  try {
    const data = await fetchReportData(type, { departmentId, startDate, endDate, employeeId });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${type || 'Report'} List`);

    if (data.length === 0) {
      worksheet.addRow(['No data available']);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report_${type}.xlsx`);
      return workbook.xlsx.write(res).then(() => res.end());
    }

    // Dynamic Columns
    const keys = Object.keys(data[0]);
    worksheet.columns = keys.map(key => ({
      header: key.charAt(0).toUpperCase() + key.slice(1),
      key: key,
      width: 20
    }));

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Dark Slate
    };

    // Add rows
    data.forEach(item => worksheet.addRow(item));

    // Headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${type || 'leaves'}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Excel generation error' });
  }
};

// ==========================================
// EXPORT PDF
// ==========================================
const exportPdfReport = async (req, res) => {
  const { type, departmentId, startDate, endDate, employeeId } = req.query;

  try {
    const data = await fetchReportData(type, { departmentId, startDate, endDate, employeeId });

    const doc = new PDFDocument({ margin: 30 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report_${type || 'leaves'}.pdf`);

    doc.pipe(res);

    // Title / Header
    doc.fontSize(18).text('HRMS Leave Management Report', { align: 'center' });
    doc.fontSize(12).text(`Report Type: ${type?.toUpperCase() || 'GENERAL LEAVE LIST'}`, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    if (data.length === 0) {
      doc.text('No matching records found.');
      doc.end();
      return;
    }

    // Dynamic Table Layout
    const keys = Object.keys(data[0]);
    const maxCols = Math.min(keys.length, 6); // Cap columns to fit horizontal PDF limits
    const displayKeys = keys.slice(0, maxCols);

    // Header Row
    let x = 30;
    const yStart = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');

    displayKeys.forEach(k => {
      doc.text(k.toUpperCase(), x, yStart, { width: 90, truncate: true });
      x += 90;
    });

    doc.moveDown(0.5);
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(30, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown(0.5);

    // Data Rows
    doc.font('Helvetica').fontSize(8);
    data.forEach(row => {
      // If close to page bottom, add page
      if (doc.y > 720) {
        doc.addPage();
        x = 30;
        const currentY = doc.y;
        doc.font('Helvetica-Bold');
        displayKeys.forEach(k => {
          doc.text(k.toUpperCase(), x, currentY, { width: 90, truncate: true });
          x += 90;
        });
        doc.moveDown(0.5);
        doc.strokeColor('#cccccc').lineWidth(1).moveTo(30, doc.y).lineTo(570, doc.y).stroke();
        doc.moveDown(0.5);
        doc.font('Helvetica');
      }

      x = 30;
      const currentY = doc.y;
      displayKeys.forEach(k => {
        const textVal = String(row[k] !== undefined && row[k] !== null ? row[k] : '');
        doc.text(textVal, x, currentY, { width: 85, height: 20, truncate: true });
        x += 90;
      });
      doc.moveDown(1.2);
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'PDF generation error' });
  }
};

module.exports = {
  getReportSummary,
  exportExcelReport,
  exportPdfReport
};
