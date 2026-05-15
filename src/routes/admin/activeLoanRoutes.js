const express = require('express');
const router = express.Router();
const {
  getAllActiveLoans,
  getDashboardStats,
  getOverdueLoans,
  getCompletedLoans,
  exportLoanData,
  getDuePayments,
  getLoanDetails,
  updateLoanStatus,
  addAdminNotes,
  softDeleteLoan,
  assignAgent
} = require('../../controllers/admin/activeLoanController');
const { protect } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');

// All routes are protected and admin-only
router.use(protect);
router.use(authorize('admin'));

// Stats and Export (must be before /:id)
router.get('/stats', getDashboardStats);
router.get('/export', exportLoanData);
router.get('/overdue', getOverdueLoans);
router.get('/completed', getCompletedLoans);
router.get('/due-payments', getDuePayments);

// Core CRUD
router.get('/', getAllActiveLoans);
router.get('/:id', getLoanDetails);
router.delete('/:id', softDeleteLoan);

// Status and Notes
router.put('/:id/status', updateLoanStatus);
router.put('/:id/notes', addAdminNotes);

// Agent Assignment
router.post('/assign-agent', assignAgent);

module.exports = router;
