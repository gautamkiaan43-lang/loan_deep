const asyncHandler = require('express-async-handler');
const LoanApplication = require('../models/LoanApplication');
const ActiveLoan = require('../models/ActiveLoan');
const Notification = require('../models/Notification');
const Borrower = require('../models/Borrower');
const User = require('../models/User');
const RepaymentSchedule = require('../models/RepaymentSchedule');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { createNotification } = require('../utils/notificationHelper');
const BorrowerAlert = require('../models/BorrowerAlert');
const LoanActivity = require('../models/LoanActivity');

/**
 * @desc    Get all loan applications with pagination, search, and filters
 * @route   GET /api/admin/loan-applications
 * @access  Private/Admin
 */
const getAllApplications = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    status, 
    staffReviewer, 
    minAmount, 
    maxAmount,
    startDate,
    endDate
  } = req.query;

  const query = {};

  // Search by borrower name, application ID, email, phone
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { applicationId: { $regex: search, $options: 'i' } },
      { emailAddress: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } },
    ];
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by staff reviewer
  if (staffReviewer) {
    query['staffReview.staffName'] = { $regex: staffReviewer, $options: 'i' };
  }

  // Filter by requested amount range
  if (minAmount || maxAmount) {
    query.requestedAmount = {};
    if (minAmount) query.requestedAmount.$gte = Number(minAmount);
    if (maxAmount) query.requestedAmount.$lte = Number(maxAmount);
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const applications = await LoanApplication.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await LoanApplication.countDocuments(query);

  // Batch-fetch borrower profiles so each row has a photo (avoids N+1 queries)
  const borrowerUserIds = applications.map(a => a.borrowerId).filter(Boolean);
  const borrowerProfiles = await Borrower.find({ userId: { $in: borrowerUserIds } })
    .select('userId fullName profilePhoto borrowerCode')
    .lean();
  const borrowerMap = {};
  borrowerProfiles.forEach(b => {
    if (b.userId) borrowerMap[b.userId.toString()] = b;
  });

  const responseData = applications.map(app => {
    const bp = borrowerMap[app.borrowerId?.toString()];
    const photoUrl = bp?.profilePhoto && bp.profilePhoto !== 'no-photo.jpg' ? bp.profilePhoto : null;
    return {
      _id: app._id,
      applicationId: app.applicationId,
      borrowerName: app.fullName,
      borrower: {
        fullName: app.fullName,
        profilePhoto: photoUrl ? { url: photoUrl } : null,
        borrowerId: bp?.borrowerCode || null,
      },
      requestedAmount: app.requestedAmount,
      requestedDuration: app.requestedDuration,
      loanDuration: app.requestedDuration,
      interestRate: app.interestRate,
      estimatedEMI: app.estimatedMonthlyEMI,
      staffReviewer: app.staffReview?.staffName ? { fullName: app.staffReview.staffName } : null,
      status: app.status,
      submittedDate: app.createdAt,
      // Full staff review details for admin visibility
      staffReview: app.staffReview?.verificationDate ? {
        recommendation: app.staffReview.recommendation,
        riskLevel: app.staffReview.riskLevel,
        staffName: app.staffReview.staffName,
        verificationDate: app.staffReview.verificationDate,
        verificationNotes: app.staffReview.verificationNotes,
      } : null,
    };
  });

  sendSuccess(res, 'Loan applications fetched successfully', {
    applications: responseData,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    }
  });
});

/**
 * @desc    Get loan application stats (counts by status)
 * @route   GET /api/admin/loan-applications/stats
 * @access  Private/Admin
 */
const getApplicationStats = asyncHandler(async (req, res) => {
  const stats = await LoanApplication.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const total = await LoanApplication.countDocuments();

  const formattedStats = {
    All: total,
    New: 0,
    'Under Review': 0,
    Recommended: 0,
    Hold: 0,
    Approved: 0,
    Rejected: 0
  };

  stats.forEach(stat => {
    if (formattedStats[stat._id] !== undefined) {
      formattedStats[stat._id] = stat.count;
    }
  });

  sendSuccess(res, 'Loan application stats fetched successfully', formattedStats);
});

const LoanEmployment = require('../models/LoanEmployment');
const LoanBanking = require('../models/LoanBanking');
const LoanDocument = require('../models/LoanDocument');

/**
 * @desc    Get single application details
 * @route   GET /api/admin/loan-applications/:id
 * @access  Private/Admin
 */
const getApplicationDetails = asyncHandler(async (req, res) => {
  const application = await LoanApplication.findById(req.params.id).lean();

  if (!application) {
    return sendError(res, 'Loan application not found', 404);
  }

  // Fetch related data
  const employment = await LoanEmployment.findOne({ loanApplicationId: application._id }).lean();
  const banking = await LoanBanking.findOne({ loanApplicationId: application._id }).lean();
  const documents = await LoanDocument.find({ loanApplicationId: application._id }).lean();

  // Format documents array into an object for the frontend
  const formattedDocs = {};
  if (documents) {
    documents.forEach(doc => {
      const key = doc.documentType === 'ID Document' ? 'idProof' :
                  doc.documentType === 'Payslip' ? 'payslip' :
                  doc.documentType === 'Bank Statement' ? 'bankStatement' :
                  doc.documentType === 'Proof Of Address' ? 'addressProof' : null;
      if (key) {
        formattedDocs[key] = {
          url: doc.fileUrl,
          fileName: doc.fileName
        };
      }
    });
  }

  // Fetch borrower profile for photo and code
  const borrowerProfile = await Borrower.findOne({ userId: application.borrowerId })
    .select('fullName profilePhoto borrowerCode')
    .lean();

  const photoUrl = borrowerProfile?.profilePhoto && borrowerProfile.profilePhoto !== 'no-photo.jpg'
    ? borrowerProfile.profilePhoto
    : null;

  // Combine data and fix field name mismatches for frontend
  const fullApplication = {
    ...employment,
    ...banking,
    ...application, // Spread application last to preserve its _id, createdAt, etc.
    yearsOfService: employment?.employmentDuration,
    accountHolder: banking?.accountHolderName,
    documents: formattedDocs,
    borrower: {
      fullName: application.fullName,
      profilePhoto: photoUrl ? { url: photoUrl } : null,
      borrowerId: borrowerProfile?.borrowerCode || null,
    },
  };

  sendSuccess(res, 'Loan application details fetched successfully', fullApplication);
});

/**
 * @desc    Approve loan application and create active loan
 * @route   PUT /api/admin/loan-applications/:id/approve
 * @access  Private/Admin
 */
const approveApplication = asyncHandler(async (req, res) => {
  const { 
    adminNotes, 
    approvedAmount, 
    finalDuration, 
    interestOverride 
  } = req.body;

  const application = await LoanApplication.findById(req.params.id);

  if (!application) {
    return sendError(res, 'Loan application not found', 404);
  }

  if (application.status === 'Approved') {
    // Check if active loan actually exists. If not, allow proceeding to fix partial state.
    const ActiveLoan = require('../models/ActiveLoan');
    const existingActive = await ActiveLoan.findOne({ loanApplicationId: application._id });
    if (existingActive) {
      return sendError(res, 'Application is already approved and active loan exists', 400);
    }
  }

  if (application.status === 'Rejected') {
    return sendError(res, 'Rejected applications cannot be approved', 400);
  }

  // Business Rule: Must be reviewed/recommended by staff first
  if (application.status === 'Submitted') {
    return sendError(res, 'Please assign a reviewer and wait for staff recommendation before taking final decision', 400);
  }

  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update application status
    application.status = 'Approved';
    application.adminDecision = {
      decision: 'Approved',
      adminNotes,
      approvedAmount: approvedAmount || application.requestedAmount,
      finalDuration: finalDuration || application.requestedDuration,
      interestOverride: interestOverride || application.interestRate,
      approvedBy: req.user._id,
      approvedDate: new Date(),
    };

    application.statusHistory.push({
      status: 'Approved',
      changedBy: req.user.fullName || req.user.name || 'Admin',
      notes: adminNotes || 'Loan application approved by admin',
    });

    await application.save({ session });

    // Create Active Loan
    const loanAmount = Number(approvedAmount) || application.requestedAmount;
    const duration = Number(finalDuration) || application.requestedDuration;
    const rate = Number(interestOverride) || application.interestRate || 10; // Default 10% if not set

    // Simple EMI Schedule Generation
    const monthlyRate = rate / 12 / 100;
    const emiAmount = Math.round(
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, duration)) /
      (Math.pow(1 + monthlyRate, duration) - 1)
    );

    const borrower = await Borrower.findById(application.borrowerId);
    
    const emiSchedule = [];
    let remainingBal = loanAmount;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + 1); // First EMI next month

    for (let i = 1; i <= duration; i++) {
      const interest = Math.round(remainingBal * monthlyRate);
      const principalAmount = emiAmount - interest;
      remainingBal -= principalAmount;

      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      emiSchedule.push({
        installmentNumber: i,
        dueDate,
        emiAmount,
        principalAmount,
        interestAmount: interest,
        paymentStatus: 'Pending',
      });
    }

    const ActiveLoan = require('../models/ActiveLoan');
    const activeLoan = await ActiveLoan.create([{
      borrowerId: application.borrowerId,
      borrowerName: application.fullName || (borrower && borrower.fullName) || 'Unknown',
      borrowerPhoto: borrower?.profilePhoto || null,
      borrowerEmail: application.emailAddress || borrower?.email,
      borrowerPhone: application.phoneNumber || borrower?.phoneNumber,
      loanApplicationId: application._id,
      loanType: application.loanType || 'Personal Loan',
      approvedAmount: loanAmount,
      interestRate: rate,
      loanDurationMonths: duration,
      emiAmount,
      totalPayableAmount: emiAmount * duration,
      remainingBalance: emiAmount * duration,
      nextDueDate: emiSchedule[0].dueDate,
      repaymentSchedule: emiSchedule,
      approvedBy: req.user._id,
    }], { session });

    // Create records in centralized RepaymentSchedule collection
    const repaymentEntries = emiSchedule.map(emi => ({
      loanId: activeLoan[0]._id,
      borrowerId: application.borrowerId,
      emiNumber: emi.installmentNumber,
      dueDate: emi.dueDate,
      amount: emi.emiAmount,
      status: 'Pending'
    }));

    await RepaymentSchedule.insertMany(repaymentEntries, { session });

    // COMMISSION LOGIC: If borrower has an assigned agent, generate commission
    if (borrower && borrower.assignedAgent) {
      const Commission = require('../models/Commission');
      const commissionPercent = 2.5; // Default 2.5%
      const commissionAmount = (loanAmount * commissionPercent) / 100;

      await Commission.create([{
        agentId: borrower.assignedAgent,
        borrowerId: borrower._id,
        loanId: activeLoan[0]._id,
        loanAmount,
        commissionPercent,
        commissionAmount,
        status: 'Pending'
      }], { session });
    }

    // Trigger Real-time / Notifications (After commit)
    try {
      // Notify Borrower
      if (borrower) {
        await createNotification({
          title: 'Approval Alert',
          message: `Loan application ${application.applicationId} for amount R ${loanAmount} has been APPROVED.`,
          notificationType: 'Approval Alert',
          priority: 'Important',
          receiverId: borrower._id,
          receiverRole: 'borrower',
          applicationId: application._id
        });

        // Create BorrowerAlert
        await BorrowerAlert.create({
          borrowerId: borrower._id,
          title: 'Loan Approved',
          message: `Congratulations! Your loan of R ${loanAmount} has been approved and is now active.`,
          alertType: 'LOAN_APPROVED',
          priority: 'High'
        });

        // Log Activity
        await LoanActivity.create({
          loanId: activeLoan[0]._id,
          borrowerId: borrower._id,
          title: 'Loan Approved',
          message: `Your loan application ${application.applicationId} was approved for R ${loanAmount}.`,
          type: 'StatusChange'
        });

        // Socket notification for borrower
        const { getIO } = require('../socket/socketServer'); 
        const io = getIO();
        if (io && borrower.userId) {
          const borrowerUserId = borrower.userId.toString();
          io.to(borrowerUserId).emit('loan-updated', { 
            status: 'Approved',
            loanId: activeLoan[0]._id,
            message: 'Your loan application has been approved'
          });
          io.to(borrowerUserId).emit('dashboard-updated');
          io.to(borrowerUserId).emit('notification-created');
        }
      }

      if (borrower && borrower.assignedAgent) {
        // Notify Agent
        await createNotification({
          receiverId: borrower.assignedAgent,
          receiverRole: 'agent',
          senderId: req.user._id,
          senderRole: 'admin',
          borrowerId: borrower._id,
          loanApplicationId: application._id,
          type: 'LOAN_APPROVAL',
          title: 'New Loan Approved',
          message: `Your borrower ${borrower.fullName}'s loan application ${application.applicationId} has been approved for R ${loanAmount}.`,
          priority: 'IMPORTANT'
        });

        // Socket notification for agent
        const { getIO } = require('../socket/socketServer'); 
        const io = getIO();
        if (io) {
          io.to(borrower.assignedAgent.toString()).emit('commission:generated', {
            message: `New commission generated for loan application ${application.applicationId}`,
            borrowerName: borrower.fullName
          });
        }
      }
    } catch (notifErr) {
      console.error('Notification failed after approval commit:', notifErr.message);
    }

    // --- COMMIT TRANSACTION ---
    await session.commitTransaction();
    session.endSession();

    sendSuccess(res, 'Loan application approved and active loan created', { application, activeLoan: activeLoan[0] });

  } catch (error) {
    // --- ROLLBACK TRANSACTION ---
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    console.error('CRITICAL APPROVAL ERROR:', error);
    return sendError(res, 'Approval failed: ' + error.message, 500);
  }
});

/**
 * @desc    Reject loan application
 * @route   PUT /api/admin/loan-applications/:id/reject
 * @access  Private/Admin
 */
const rejectApplication = asyncHandler(async (req, res) => {
  const { rejectionReason } = req.body;

  const application = await LoanApplication.findById(req.params.id);

  if (!application) {
    return sendError(res, 'Loan application not found', 404);
  }

  // Business Rule: Must be reviewed/recommended by staff first
  if (application.status === 'Submitted') {
    return sendError(res, 'Please assign a reviewer and wait for staff recommendation before taking final decision', 400);
  }

  application.status = 'Rejected';
  application.adminDecision = {
    decision: 'Rejected',
    rejectionReason,
    rejectedBy: req.user._id,
    rejectedDate: new Date(),
  };

  application.statusHistory.push({
    status: 'Rejected',
    changedBy: req.user.name || 'Admin',
    notes: rejectionReason || 'Loan application rejected by admin',
  });

  await application.save();

  // Notify Borrower & Create Admin Realtime Log
  const borrower = await Borrower.findById(application.borrowerId);
  if (borrower) {
    try {
      await createNotification({
        title: 'Approval Alert',
        message: `Loan application ${application.applicationId} has been REJECTED. Reason: ${rejectionReason || 'Policy mismatch'}`,
        notificationType: 'Approval Alert',
        priority: 'Important',
        receiverId: borrower._id,
        receiverRole: 'borrower',
        applicationId: application._id
      });

      // Create BorrowerAlert
      await BorrowerAlert.create({
        borrowerId: borrower._id,
        title: 'Application Rejected',
        message: `Your loan application ${application.applicationId} was rejected. Reason: ${rejectionReason || 'N/A'}`,
        alertType: 'REJECTION',
        priority: 'High'
      });

      // Socket notification
      const { getIO } = require('../socket/socketServer'); 
      const io = getIO();
      if (io && borrower.userId) {
        io.to(borrower.userId.toString()).emit('dashboard-updated');
        io.to(borrower.userId.toString()).emit('notification-created');
      }
    } catch (err) {}
  }

  sendSuccess(res, 'Loan application rejected', application);
});

/**
 * @desc    Put loan application on hold
 * @route   PUT /api/admin/loan-applications/:id/hold
 * @access  Private/Admin
 */
const holdApplication = asyncHandler(async (req, res) => {
  const { holdReason } = req.body;

  const application = await LoanApplication.findById(req.params.id);

  if (!application) {
    return sendError(res, 'Loan application not found', 404);
  }

  // Business Rule: Must be reviewed/recommended by staff first
  if (application.status === 'Submitted') {
    return sendError(res, 'Please assign a reviewer and wait for staff recommendation before taking final decision', 400);
  }

  application.status = 'Hold';
  application.adminDecision = {
    decision: 'Hold',
    holdReason,
    holdBy: req.user._id,
    holdDate: new Date(),
  };

  application.statusHistory.push({
    status: 'Hold',
    changedBy: req.user.name || 'Admin',
    notes: holdReason || 'Loan application put on hold by admin',
  });

  await application.save();

  // Notify Borrower & Create Admin Realtime Log
  const borrower = await Borrower.findById(application.borrowerId);
  if (borrower) {
    try {
      await createNotification({
        title: 'Application Alert',
        message: `Loan application ${application.applicationId} has been placed ON HOLD.`,
        notificationType: 'System Alert',
        priority: 'Normal',
        receiverId: borrower._id,
        receiverRole: 'borrower',
        applicationId: application._id
      });

      // Create BorrowerAlert
      await BorrowerAlert.create({
        borrowerId: borrower._id,
        title: 'Application On Hold',
        message: `Your loan application ${application.applicationId} is currently on hold. Reason: ${holdReason || 'Review pending'}`,
        alertType: 'SYSTEM_ALERT',
        priority: 'Medium'
      });

      // Socket notification
      const { getIO } = require('../socket/socketServer'); 
      const io = getIO();
      if (io && borrower.userId) {
        io.to(borrower.userId.toString()).emit('dashboard-updated');
        io.to(borrower.userId.toString()).emit('notification-created');
      }
    } catch (err) {}
  }

  sendSuccess(res, 'Loan application put on hold', application);
});

/**
 * @desc    Update staff review / recommendation
 * @route   PUT /api/admin/loan-applications/:id/review
 * @access  Private/Admin
 */
const updateStaffReview = asyncHandler(async (req, res) => {
  const { 
    verificationNotes, 
    recommendation, 
    riskLevel 
  } = req.body;

  const application = await LoanApplication.findById(req.params.id);

  if (!application) {
    return sendError(res, 'Loan application not found', 404);
  }

  application.staffReview = {
    reviewedBy: req.user._id,
    staffName: req.user.name || 'Admin',
    verificationNotes,
    recommendation,
    riskLevel,
    verificationDate: new Date(),
  };

  // If staff recommends, update status to Recommended
  if (recommendation === 'Recommended') {
    application.status = 'Recommended';
  } else if (recommendation === 'Rejected') {
    application.status = 'Rejected';
  } else {
    application.status = 'Under Review';
  }

  application.statusHistory.push({
    status: application.status,
    changedBy: req.user.name || 'Admin',
    notes: `Staff review: ${recommendation}. ${verificationNotes || ''}`,
  });

  await application.save();

  sendSuccess(res, 'Staff review updated successfully', application);
});

/**
 * @desc    Assign staff reviewer to loan application
 * @route   POST /api/admin/loan-applications/assign-reviewer
 * @access  Private (Admin)
 */
const assignReviewer = asyncHandler(async (req, res) => {
  const { applicationId, staffId, notes } = req.body;

  if (!applicationId || !staffId) {
    return sendError(res, 'Application ID and Staff ID are required', 400);
  }

  // 1. Validations
  const application = await LoanApplication.findById(applicationId);
  if (!application) return sendError(res, 'Application Not Found', 404);

  if (['Approved', 'Rejected', 'Disbursed'].includes(application.status)) {
    return sendError(res, 'Application Already Closed', 400);
  }

  const staffUser = await User.findById(staffId);
  if (!staffUser || staffUser.role !== 'staff') {
    return sendError(res, 'Invalid Staff Role', 400);
  }

  // 2. Atomic Update using Transaction
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const LoanReview = require('../models/LoanReview');
    const LoanStatusHistory = require('../models/LoanStatusHistory');
    const Conversation = require('../models/Conversation');
    const { createNotification } = require('../utils/notificationHelper');

    // A. Update Application
    application.status = 'Under Review';
    application.assignedReviewer = staffId;
    application.assignedAt = new Date();
    application.assignedBy = req.user._id;
    await application.save({ session });

    // B. Create/Update LoanReview Task
    await LoanReview.findOneAndUpdate(
      { loanApplicationId: application._id },
      { 
        reviewerId: staffId,
        reviewerRole: 'staff',
        status: 'Pending',
        notes: notes || 'Assigned by Admin'
      },
      { upsert: true, session }
    );

    // C. Status History
    await LoanStatusHistory.create([{
      loanApplicationId: application._id,
      status: 'Under Review',
      notes: notes || `Reviewer assigned: ${staffUser.fullName}`,
      changedBy: req.user._id
    }], { session });

    // D. Notifications
    await createNotification({
      receiverId: staffId,
      receiverRole: 'staff',
      senderId: req.user._id,
      senderRole: 'admin',
      type: 'loan_review_assignment',
      title: 'New Loan Review Assigned',
      message: `A new application ${application.applicationId} requires your review.`,
      relatedId: application._id,
      relatedModel: 'LoanApplication',
      priority: 'important'
    });

    await createNotification({
      receiverId: application.borrowerId,
      receiverRole: 'borrower',
      senderId: req.user._id,
      senderRole: 'admin',
      type: 'application_under_review',
      title: 'Application Under Review',
      message: `Your loan application ${application.applicationId} is now under review.`,
      relatedId: application._id,
      relatedModel: 'LoanApplication'
    });

    // E. Communication Thread (Check/Add Staff to conversation)
    if (application.conversationId) {
      await Conversation.findByIdAndUpdate(
        application.conversationId,
        { $addToSet: { participants: staffId } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // F. Socket Events (Post-Commit)
    const { getIO } = require('../socket/socketServer');
    const io = getIO();
    if (io) {
      io.emit('admin:loanAssigned', { applicationId: application._id, staffName: staffUser.fullName });
      io.to(staffId.toString()).emit('staff:newReviewTask', { applicationId: application._id });
      io.to(application.borrowerId.toString()).emit('borrower:statusUpdated', { status: 'Under Review' });
    }

    sendSuccess(res, 'Reviewer assigned successfully', { application });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

module.exports = {
  getApplicationStats,
  getAllApplications,
  getApplicationDetails,
  approveApplication,
  rejectApplication,
  holdApplication,
  updateStaffReview,
  assignReviewer
};
