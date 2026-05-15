const LoanApplication = require('../../models/LoanApplication');
const Payment = require('../../models/Payment');
const Notification = require('../../models/Notification');
const Borrower = require('../../models/Borrower');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/responseHandler');

/**
 * @desc    Get staff dashboard dynamic analytics and workflow data
 * @route   GET /api/staff/dashboard
 * @access  Private/Staff
 */
exports.getDashboardData = asyncHandler(async (req, res) => {
  const staffId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. ANALYTICS CARDS
  
  // Pending Applications assigned to this staff
  const pendingApplicationsCount = await LoanApplication.countDocuments({
    'staffReview.reviewedBy': staffId,
    status: { $in: ['New', 'Pending Review', 'Under Review'] }
  });

  // Pending Verifications (Payments for borrowers assigned to this staff)
  // First find borrowers assigned to this staff
  const assignedBorrowerIds = await Borrower.find({ assignedStaff: staffId }).distinct('_id');
  
  const pendingVerificationsCount = await Payment.countDocuments({
    borrowerId: { $in: assignedBorrowerIds },
    paymentStatus: 'Pending'
  });

  // Reviewed Today by logged-in staff
  const reviewedTodayCount = await LoanApplication.countDocuments({
    'staffReview.reviewedBy': staffId,
    'staffReview.verificationDate': { $gte: today },
    status: { $in: ['Reviewed', 'Recommended'] }
  });

  // Recent Activities count (Using notifications as a proxy for operational actions)
  // Or count applications that were moved out of 'New' or 'Under Review' today
  const recentActivitiesCount = await LoanApplication.countDocuments({
    'staffReview.reviewedBy': staffId,
    updatedAt: { $gte: today }
  }) + await Payment.countDocuments({
    verifiedBy: staffId,
    updatedAt: { $gte: today }
  });

  const workflowQueue = await LoanApplication.find({
    'staffReview.reviewedBy': staffId,
    status: { $in: ['New', 'Under Review', 'Pending Verification', 'Pending Review'] }
  })
  .sort({ updatedAt: -1 })
  .limit(10)
  .populate('borrowerId', 'phoneNumber');

  const formattedQueue = workflowQueue.map(app => ({
    applicationId: app._id,
    borrowerId: app.borrowerId?._id,
    borrowerName: app.fullName,
    borrowerPhone: app.borrowerId?.phoneNumber || app.phoneNumber,
    loanId: app.applicationId,
    loanType: app.loanType || 'Personal Loan',
    loanAmount: app.requestedAmount,
    currentStatus: app.status,
    assignedDate: app.updatedAt
  }));

  // 2.5 VERIFICATIONS QUEUE (Payments pending verification for assigned borrowers)
  const pendingPayments = await Payment.find({
    borrowerId: { $in: assignedBorrowerIds },
    paymentStatus: 'Pending'
  })
  .sort({ createdAt: -1 })
  .limit(10);

  const verificationsQueue = pendingPayments.map(pay => ({
    id: pay._id,
    borrowerId: pay.borrowerId,
    borrowerName: pay.borrowerName,
    type: pay.paymentType || 'Payment Verification',
    status: pay.paymentStatus,
    date: pay.paymentDate,
    amount: pay.paymentAmount,
    transactionId: pay.transactionId
  }));

  // 3. PRIORITY ALERTS (Urgent operational alerts from Notification model)
  const priorityAlerts = await Notification.find({
    receiverId: staffId,
    isRead: false
  })
  .sort({ priority: 1, createdAt: -1 }) // Urgent first
  .limit(5);

  const formattedAlerts = priorityAlerts.map(alert => ({
    id: alert._id,
    alertType: alert.notificationType,
    title: alert.title,
    message: alert.message,
    createdAt: alert.createdAt,
    priority: alert.priority || 'normal'
  }));

  // 4. RECENT ACTIVITIES LIST
  // Fetching both applications reviewed and payments verified
  const recentApps = await LoanApplication.find({
    'staffReview.reviewedBy': staffId,
    status: { $nin: ['New', 'Under Review'] }
  })
  .sort({ updatedAt: -1 })
  .limit(5);

  const recentPayments = await Payment.find({
    verifiedBy: staffId
  })
  .sort({ updatedAt: -1 })
  .limit(5);

  const recentActivities = [
    ...recentApps.map(app => ({
      type: 'application',
      title: 'Application Reviewed',
      description: `Reviewed ${app.applicationId} for ${app.fullName}`,
      time: app.updatedAt,
      status: app.status
    })),
    ...recentPayments.map(pay => ({
      type: 'payment',
      title: 'Payment Verified',
      description: `Verified ${pay.transactionId} for ${pay.borrowerName}`,
      time: pay.updatedAt,
      status: pay.paymentStatus
    }))
  ].sort((a, b) => b.time - a.time).slice(0, 8);

  sendSuccess(res, 'Staff dashboard data retrieved', {
    analytics: {
      pendingApplications: pendingApplicationsCount,
      pendingVerifications: pendingVerificationsCount,
      reviewedToday: reviewedTodayCount,
      recentActivities: recentActivitiesCount
    },
    workflowQueue: formattedQueue,
    verificationsQueue: verificationsQueue,
    priorityAlerts: formattedAlerts,
    recentActivities: recentActivities,
    quickActionCounts: {
      reviewQueue: pendingApplicationsCount,
      verificationQueue: pendingVerificationsCount,
      urgentAlerts: priorityAlerts.filter(a => a.priority === 'urgent').length
    }
  });
});
