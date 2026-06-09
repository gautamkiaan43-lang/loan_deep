const asyncHandler = require('express-async-handler');
const nupayService = require('../../services/nupayService');
const LoanApplication = require('../../models/LoanApplication');
const DuePayment = require('../../models/DuePayment');
const ActiveLoan = require('../../models/ActiveLoan');
const { sendSuccess, sendError } = require('../../utils/responseHandler');

const initiateDebiCheckMandate = asyncHandler(async (req, res) => {
  const { applicationId } = req.body;
  const loanApp = await LoanApplication.findById(applicationId);
  if (!loanApp) {
    return sendError(res, 'Loan application not found', 404);
  }

  try {
    const result = await nupayService.initiateMandate(loanApp);
    
    // Save mandate details to application
    loanApp.debicheckMandateStatus = result.status || 'Pending Authentication';
    loanApp.debicheckMandateReference = result.reference;
    await loanApp.save();

    sendSuccess(res, 'DebiCheck mandate initiated successfully', {
      status: loanApp.debicheckMandateStatus,
      reference: loanApp.debicheckMandateReference,
      message: result.message
    });
  } catch (err) {
    sendError(res, err.message || 'Failed to initiate DebiCheck mandate', 500);
  }
});

const rescheduleNuPayInstalment = asyncHandler(async (req, res) => {
  const { duePaymentId, submitDate, trackingIndicator } = req.body;
  const duePayment = await DuePayment.findById(duePaymentId);
  if (!duePayment) {
    return sendError(res, 'Due payment record not found', 404);
  }

  try {
    const result = await nupayService.rescheduleInstalment({
      contractReference: duePayment.loanCode,
      submitDate,
      trackingIndicator
    });

    // 1. Update the ActiveLoan schedule item due date so the sync doesn't overwrite it
    const loan = await ActiveLoan.findById(duePayment.loanId);
    if (loan) {
      const inst = loan.repaymentSchedule.find(i => i.installmentNumber === duePayment.installmentNumber);
      if (inst) {
        inst.dueDate = new Date(submitDate);
        inst.paymentStatus = 'Pending'; // Reset to pending if it was overdue
        await loan.save();
      }
    }

    // 2. Update the DuePayment record
    duePayment.dueStatus = 'Rescheduled';
    duePayment.dueDate = new Date(submitDate);
    duePayment.overdueDays = 0; // Reset overdue days
    await duePayment.save();

    sendSuccess(res, 'Instalment rescheduled successfully via NuPay', { result });
  } catch (err) {
    sendError(res, err.message || 'Failed to reschedule instalment', 500);
  }
});

const maintainNuPayInstalment = asyncHandler(async (req, res) => {
  const { duePaymentId, amount, trackingDays, applyToAll } = req.body;
  const duePayment = await DuePayment.findById(duePaymentId);
  if (!duePayment) {
    return sendError(res, 'Due payment record not found', 404);
  }

  try {
    const result = await nupayService.maintainInstalment({
      contractReference: duePayment.loanCode,
      instalmentAmount: amount,
      trackingDays,
      applyToAll
    });

    duePayment.emiAmount = amount;
    duePayment.totalDueAmount = amount + (duePayment.penaltyAmount || 0);
    await duePayment.save();

    sendSuccess(res, 'Instalment details maintained successfully via NuPay', { result });
  } catch (err) {
    sendError(res, err.message || 'Failed to maintain instalment details', 500);
  }
});

const cancelNuPayInstalment = asyncHandler(async (req, res) => {
  const { duePaymentId } = req.body;
  const duePayment = await DuePayment.findById(duePaymentId);
  if (!duePayment) {
    return sendError(res, 'Due payment record not found', 404);
  }

  try {
    const result = await nupayService.cancelInstalment({
      contractReference: duePayment.loanCode
    });

    duePayment.dueStatus = 'Cancelled';
    await duePayment.save();

    sendSuccess(res, 'Instalment cancelled successfully via NuPay', { result });
  } catch (err) {
    sendError(res, err.message || 'Failed to cancel instalment', 500);
  }
});

const recallNuPayInstalment = asyncHandler(async (req, res) => {
  const { duePaymentId } = req.body;
  const duePayment = await DuePayment.findById(duePaymentId);
  if (!duePayment) {
    return sendError(res, 'Due payment record not found', 404);
  }

  try {
    const result = await nupayService.recallInstalment({
      contractReference: duePayment.loanCode
    });

    duePayment.dueStatus = 'Recalled';
    await duePayment.save();

    sendSuccess(res, 'Instalment recalled successfully via NuPay', { result });
  } catch (err) {
    sendError(res, err.message || 'Failed to recall instalment', 500);
  }
});

module.exports = {
  initiateDebiCheckMandate,
  rescheduleNuPayInstalment,
  maintainNuPayInstalment,
  cancelNuPayInstalment,
  recallNuPayInstalment
};
