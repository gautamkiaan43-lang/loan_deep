/**
 * Verification Integration Controller
 * Orchestrates calls to the Datanamix module and commits audit histories to MongoDB.
 */

const datanamix = require('../integrations/datanamix');
const VerificationLog = require('../models/VerificationLog');
const CreditReport = require('../models/CreditReport');
const AMLCheck = require('../models/AMLCheck');
const BankVerification = require('../models/BankVerification');
const Borrower = require('../models/Borrower');
const LoanApplication = require('../models/LoanApplication');
const { callProfileIdPhotoMatch } = require('../services/datanamix/profileIdPhotoVerification.service');
const { callAddressPlusProfileIdv } = require('../services/datanamix/addressProfileIdv.service');
const { callConsumerCreditSearch } = require('../services/datanamix/consumerCreditSearch.service');
const { callConsumerCreditResult }  = require('../services/datanamix/consumerCreditResult.service');
const { getIO } = require('../socket/socketServer');

/**
 * Helper to log verification transactions to MongoDB VerificationLog collection
 */
const writeAuditLog = async (data) => {
  try {
    return await VerificationLog.create(data);
  } catch (err) {
    console.error('⚠️ [Audit Log Error]: Failed to write log to database:', err.message);
  }
};

/**
 * 1. Borrower ID Verification Controller (DHA Profile IDV Plus Photo)
 */
exports.verifyIdentityController = async (req, res) => {
  const { borrowerId, idNumber, fullName, dateOfBirth, selfiePhotoBase64, applicationId } = req.body;
  const initiatedBy = req.user ? req.user._id : null;

  try {
    console.log(`👤 [Identity Verification Route Handled] - ID: ${idNumber}`);

    // Call integration module
    const result = await datanamix.identity.verifyIdentity({
      idNumber,
      fullName,
      dateOfBirth,
      selfiePhotoBase64
    });

    // Write audit log
    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'IDV_PHOTO',
      status: 'SUCCESS',
      initiatedBy,
      requestPayload: { idNumber, fullName, dateOfBirth },
      responsePayload: result
    });

    return res.status(200).json({
      success: true,
      message: 'ID Verification initialized successfully in pre-integration phase.',
      data: result
    });
  } catch (error) {
    console.error('❌ [Identity Controller Error]:', error.message);
    
    // Log failure
    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'IDV_PHOTO',
      status: 'FAILED',
      initiatedBy,
      requestPayload: { idNumber, fullName, dateOfBirth },
      errorMessage: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error occurred during ID verification.'
    });
  }
};

/**
 * 2. Face Liveness Verification Controller (FaceTec Liveness 3D)
 */
exports.verifyFaceLivenessController = async (req, res) => {
  const { borrowerId, faceScan, auditTrailImage, sessionId, applicationId } = req.body;
  const initiatedBy = req.user ? req.user._id : null;

  try {
    console.log(`🎭 [Face Liveness Route Handled] - Session: ${sessionId}`);

    const result = await datanamix.identity.verifyFaceLiveness({
      faceScan,
      auditTrailImage,
      sessionId
    });

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'FACETEC_LIVENESS',
      status: 'SUCCESS',
      initiatedBy,
      requestPayload: { sessionId },
      responsePayload: result
    });

    return res.status(200).json({
      success: true,
      message: 'Face Tec Liveness validation initialized successfully.',
      data: result
    });
  } catch (error) {
    console.error('❌ [Face Liveness Controller Error]:', error.message);

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'FACETEC_LIVENESS',
      status: 'FAILED',
      initiatedBy,
      requestPayload: { sessionId },
      errorMessage: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error occurred during face liveness verification.'
    });
  }
};

/**
 * 3. Bank Account Ownership Verification Controller (Account Holder Verification Advanced)
 */
exports.verifyBankController = async (req, res) => {
  const { borrowerId, bankName, accountNumber, branchCode, idNumber, accountHolderName, accountType, applicationId } = req.body;
  const initiatedBy = req.user ? req.user._id : null;

  try {
    console.log(`🏦 [Bank AHV Route Handled] - Acc: ${accountNumber}`);

    const result = await datanamix.bank.verifyBankAccount({
      bankName,
      accountNumber,
      branchCode,
      idNumber,
      accountHolderName,
      accountType
    });

    // Persistent storage model creation
    await BankVerification.create({
      borrowerId,
      applicationId,
      bankName,
      accountNumber,
      branchCode,
      matchIndicators: result.matchIndicators,
      rawVerificationResult: result,
      verificationSuccess: false
    });

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'BANK_AHV',
      status: 'SUCCESS',
      initiatedBy,
      requestPayload: { bankName, accountNumber, branchCode, idNumber, accountHolderName },
      responsePayload: result
    });

    return res.status(200).json({
      success: true,
      message: 'Bank verification records generated in pre-integration phase.',
      data: result
    });
  } catch (error) {
    console.error('❌ [Bank Verification Controller Error]:', error.message);

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'BANK_AHV',
      status: 'FAILED',
      initiatedBy,
      requestPayload: { bankName, accountNumber, branchCode, idNumber, accountHolderName },
      errorMessage: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error occurred during bank account verification.'
    });
  }
};

/**
 * 4. Credit Bureau Checks Controller (Consumer Credit Report)
 */
exports.verifyCreditController = async (req, res) => {
  const { borrowerId, idNumber, fullName, consentAccepted, applicationId } = req.body;
  const initiatedBy = req.user ? req.user._id : null;

  try {
    console.log(`📊 [Credit Bureau Check Route Handled] - ID: ${idNumber}`);

    const result = await datanamix.credit.getConsumerCreditReport({
      idNumber,
      fullName,
      consentAccepted
    });

    // Persistent storage model creation
    await CreditReport.create({
      borrowerId,
      applicationId,
      creditScore: 0, // Placeholder during blueprint phase
      scoreBand: 'UNKNOWN',
      riskCategory: 'N/A',
      consentAccepted,
      bureauRawData: result
    });

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'CREDIT_REPORT',
      status: 'SUCCESS',
      initiatedBy,
      requestPayload: { idNumber, fullName, consentAccepted },
      responsePayload: result
    });

    return res.status(200).json({
      success: true,
      message: 'Credit Bureau lookup pre-flight verification completed.',
      data: result
    });
  } catch (error) {
    console.error('❌ [Credit Controller Error]:', error.message);

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'CREDIT_REPORT',
      status: 'FAILED',
      initiatedBy,
      requestPayload: { idNumber, fullName, consentAccepted },
      errorMessage: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error occurred during credit bureau report pulling.'
    });
  }
};

/**
 * 5. Phone Verification Controller (Carrier Identity)
 */
exports.verifyPhoneController = async (req, res) => {
  const { borrowerId, phoneNumber, idNumber, fullName, applicationId } = req.body;
  const initiatedBy = req.user ? req.user._id : null;

  try {
    console.log(`📱 [Phone Verification Route Handled] - Phone: ${phoneNumber}`);

    const result = await datanamix.phone.verifyPhoneOwnership({
      phoneNumber,
      idNumber,
      fullName
    });

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'PHONE_CARRIER',
      status: 'SUCCESS',
      initiatedBy,
      requestPayload: { phoneNumber, idNumber, fullName },
      responsePayload: result
    });

    return res.status(200).json({
      success: true,
      message: 'Carrier identity matching process prepared.',
      data: result
    });
  } catch (error) {
    console.error('❌ [Phone Controller Error]:', error.message);

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'PHONE_CARRIER',
      status: 'FAILED',
      initiatedBy,
      requestPayload: { phoneNumber, idNumber, fullName },
      errorMessage: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error occurred during phone carrier verification.'
    });
  }
};

/**
 * 6. AML & Sanctions Screening Controller (AML Sanctions + PEP + Crime Data)
 */
exports.verifyAMLController = async (req, res) => {
  const { borrowerId, idNumber, fullName, dateOfBirth, applicationId } = req.body;
  const initiatedBy = req.user ? req.user._id : null;

  try {
    console.log(`🛡️ [AML pep Screening Route Handled] - Name: ${fullName}`);

    const result = await datanamix.aml.screenAML({
      idNumber,
      fullName,
      dateOfBirth
    });

    // Persistent storage model creation
    await AMLCheck.create({
      borrowerId,
      pepStatusDetected: false,
      sanctionStatusDetected: false,
      crimeRecordDetected: false,
      riskScore: 0,
      screeningRawResponse: result,
      complianceOutcome: 'PASSED'
    });

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'AML_PEP',
      status: 'SUCCESS',
      initiatedBy,
      requestPayload: { idNumber, fullName, dateOfBirth },
      responsePayload: result
    });

    return res.status(200).json({
      success: true,
      message: 'AML watchlists verification logged.',
      data: result
    });
  } catch (error) {
    console.error('❌ [AML pep Screening Controller Error]:', error.message);

    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'AML_PEP',
      status: 'FAILED',
      initiatedBy,
      requestPayload: { idNumber, fullName, dateOfBirth },
      errorMessage: error.message
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error occurred during AML sanctions screening.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. KYC Profile Plus ID Photo Match Verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/verification/profile-id-photo-match
 * Multipart: idFrontImage (required), selfieImage (optional), idBackImage (optional)
 * Body fields: idNumber (required), applicationId (optional), borrowerId (optional)
 */
exports.verifyBorrowerKYCController = async (req, res) => {
  const initiatedBy = req.user?._id;
  const { idNumber, applicationId, borrowerId: bodyBorrowerId } = req.body;

  // borrowerId: use body value or fall back to the authenticated user's _id
  const borrowerId = bodyBorrowerId || initiatedBy;

  if (!idNumber) {
    return res.status(400).json({ success: false, message: 'idNumber is required' });
  }

  const idFrontFile = req.files?.idFrontImage?.[0] || req.file;
  if (!idFrontFile) {
    return res.status(400).json({ success: false, message: 'idFrontImage is required' });
  }

  try {
    console.log(`[KYC Controller] Starting verification — ID: ${idNumber}`);

    const result = await callProfileIdPhotoMatch({
      idNumber,
      captureImageBuffer: idFrontFile.buffer,
      clientReference: applicationId || `TEMP-${Date.now()}`,
    });

    // ── Audit log ──────────────────────────────────────────────────────────
    await writeAuditLog({
      borrowerId,
      applicationId: applicationId || undefined,
      verificationType: 'KYC_PROFILE_PHOTO',
      status: result.verificationStatus === 'Verified' ? 'SUCCESS' : 'FAILED',
      initiatedBy,
      requestPayload: { idNumber, clientReference: applicationId },
      responsePayload: {
        responseStatusCode: result.responseStatusCode,
        verificationStatus: result.verificationStatus,
        faceMatchScore: result.faceMatchScore,
        verificationReference: result.verificationReference,
      },
    });

    // ── Persist into LoanApplication if applicationId provided ─────────────
    if (applicationId) {
      await LoanApplication.findByIdAndUpdate(applicationId, {
        'kycVerification.verificationStatus': result.verificationStatus,
        'kycVerification.responseStatusCode': result.responseStatusCode,
        'kycVerification.responseMessage': result.responseMessage,
        'kycVerification.faceMatchScore': result.faceMatchScore,
        'kycVerification.verificationReference': result.verificationReference,
        'kycVerification.verificationTimestamp': new Date(),
        'kycVerification.fraudFlags': result.fraudFlags,
        'kycVerification.extractedOCRData': result.extractedOCRData,
        'kycVerification.verificationPdf': result.verificationPdf,
        'kycVerification.rawApiResponse': result.rawApiResponse,
        'kycVerification.verifiedBy': initiatedBy,
        'kycVerification.verificationSource': 'DATANAMIX',
        'kycVerification.verificationProvider': 'Profile Plus ID Photo Match',
      });
    }

    // ── Socket events ──────────────────────────────────────────────────────
    try {
      const io = getIO();
      const roomId = borrowerId?.toString();
      if (result.verificationStatus === 'Verified') {
        io.to(roomId).emit('verification-completed', {
          applicationId,
          faceMatchScore: result.faceMatchScore,
          message: 'Identity verified successfully',
        });
      } else {
        io.to(roomId).emit('verification-failed', {
          applicationId,
          responseMessage: result.responseMessage,
          message: 'Identity verification failed',
        });

        if (result.fraudFlags?.length) {
          io.to(roomId).emit('fraud-flagged', {
            applicationId,
            fraudFlags: result.fraudFlags,
          });
        }
      }
    } catch {
      // Socket not initialized — non-fatal
    }

    return res.status(200).json({
      success: true,
      message: result.verificationStatus === 'Verified'
        ? 'Identity verified successfully'
        : 'Identity verification failed',
      data: {
        verificationStatus: result.verificationStatus,
        responseStatusCode: result.responseStatusCode,
        responseMessage: result.responseMessage,
        faceMatchScore: result.faceMatchScore,
        verificationReference: result.verificationReference,
        verificationTimestamp: new Date(),
        fraudFlags: result.fraudFlags,
        extractedOCRData: result.extractedOCRData,
      },
    });
  } catch (error) {
    console.error('[KYC Controller Error]:', error.message);

    await writeAuditLog({
      borrowerId,
      applicationId: applicationId || undefined,
      verificationType: 'KYC_PROFILE_PHOTO',
      status: 'ERROR',
      initiatedBy,
      requestPayload: { idNumber },
      errorMessage: error.message,
    });

    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'KYC verification failed',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. Admin KYC Override
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/verification/kyc-override/:applicationId
 * Admin only — manually override a failed KYC verification with mandatory reason
 */
exports.overrideKYCController = async (req, res) => {
  const { applicationId } = req.params;
  const { overrideReason } = req.body;
  const adminId = req.user?._id;

  if (!overrideReason?.trim()) {
    return res.status(400).json({ success: false, message: 'overrideReason is required for KYC override' });
  }

  try {
    const application = await LoanApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    await LoanApplication.findByIdAndUpdate(applicationId, {
      'kycVerification.verificationStatus': 'Overridden',
      'kycVerification.overrideReason': overrideReason.trim(),
      'kycVerification.overrideBy': adminId,
      'kycVerification.overrideAt': new Date(),
    });

    // Audit log for override
    await writeAuditLog({
      borrowerId: application.borrowerId || adminId,
      applicationId,
      verificationType: 'KYC_OVERRIDE',
      status: 'SUCCESS',
      initiatedBy: adminId,
      requestPayload: { overrideReason, applicationId },
      responsePayload: { action: 'KYC_MANUAL_OVERRIDE', overrideBy: adminId },
    });

    // Socket — notify borrower room
    try {
      const io = getIO();
      io.to(application.borrowerId?.toString()).emit('verification-completed', {
        applicationId,
        message: 'KYC verification manually overridden by admin',
        overridden: true,
      });
    } catch {
      // Socket not initialized — non-fatal
    }

    return res.status(200).json({
      success: true,
      message: 'KYC verification successfully overridden',
      data: { applicationId, overrideReason, overrideAt: new Date() },
    });
  } catch (error) {
    console.error('[KYC Override Error]:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Override failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. Address Plus Profile IDV (Bureau Verification — Step 1.5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/verification/address-plus-profile-idv
 *
 * Requires biometric KYC (Step 1) to be Verified or Overridden first.
 * Body: { applicationId, idNumber, surname, passportNumber?,
 *          phoneNumber?, emailAddress?, residentialAddress?, employerName? }
 */
exports.verifyAddressProfileController = async (req, res) => {
  const initiatedBy = req.user?._id;
  const {
    applicationId,
    idNumber,
    surname,
    passportNumber,
    phoneNumber,
    emailAddress,
    residentialAddress,
    employerName,
    borrowerId: bodyBorrowerId,
  } = req.body;

  const borrowerId = bodyBorrowerId || initiatedBy;

  if (!idNumber) return res.status(400).json({ success: false, message: 'idNumber is required' });
  if (!surname)  return res.status(400).json({ success: false, message: 'surname is required' });

  try {
    // ── Guard: biometric must be completed first ───────────────────────────
    if (applicationId) {
      const app = await LoanApplication.findById(applicationId).select('kycVerification');
      if (app) {
        const kycStatus = app.kycVerification?.verificationStatus;
        if (!kycStatus || kycStatus === 'Pending' || kycStatus === 'Failed') {
          return res.status(400).json({
            success: false,
            message: 'Biometric identity verification must be completed before bureau verification.',
          });
        }
      }
    }

    console.log(`[BUREAU Controller] Starting bureau verification — ID: ${idNumber}`);

    const result = await callAddressPlusProfileIdv({
      surname,
      idNumber,
      passportNumber: passportNumber || '',
      clientReference: applicationId || `BUREAU-${Date.now()}`,
      borrowerData: { fullName: `${surname}`, phoneNumber, emailAddress, residentialAddress, employerName },
    });

    // ── Determine block-level ──────────────────────────────────────────────
    // Fatal: deceased or SAFPS listing blocks progression
    const isFatal = result.deceasedStatus || result.safpsFlag;
    const hasWarnings = result.mismatchFlags?.length > 0;

    // ── Persist to LoanApplication ─────────────────────────────────────────
    if (applicationId) {
      await LoanApplication.findByIdAndUpdate(applicationId, {
        'bureauVerification.verificationStatus': result.verificationStatus,
        'bureauVerification.responseCode':    result.responseCode,
        'bureauVerification.responseMessage': result.responseMessage,
        'bureauVerification.bureauReference': result.bureauReference,
        'bureauVerification.verifiedFirstName':          result.verifiedFirstName,
        'bureauVerification.verifiedSurname':            result.verifiedSurname,
        'bureauVerification.verifiedPhone':              result.verifiedPhone,
        'bureauVerification.verifiedEmail':              result.verifiedEmail,
        'bureauVerification.verifiedEmployer':           result.verifiedEmployer,
        'bureauVerification.verifiedResidentialAddress': result.verifiedResidentialAddress,
        'bureauVerification.verifiedPostalAddress':      result.verifiedPostalAddress,
        'bureauVerification.deceasedStatus': result.deceasedStatus,
        'bureauVerification.deceasedDate':   result.deceasedDate,
        'bureauVerification.safpsFlag':      result.safpsFlag,
        'bureauVerification.fraudIndicators': result.fraudFlags,
        'bureauVerification.addressHistory': result.addressHistory,
        'bureauVerification.pdfReport':      result.pdfReport,
        'bureauVerification.bureauRawResponse': result.bureauRawResponse,
        'bureauVerification.verifiedAt':     new Date(),
        'bureauVerification.comparedFields': result.comparedFields,
        'bureauVerification.mismatchFlags':  result.mismatchFlags,
        'bureauVerification.verifiedBy':     initiatedBy,
      });
    }

    // ── Audit log ──────────────────────────────────────────────────────────
    await writeAuditLog({
      borrowerId,
      applicationId: applicationId || undefined,
      verificationType: 'BUREAU_PROFILE_VERIFICATION',
      status: isFatal ? 'FAILED' : 'SUCCESS',
      initiatedBy,
      requestPayload: { idNumber, surname, clientReference: applicationId },
      responsePayload: {
        verificationStatus: result.verificationStatus,
        bureauReference:    result.bureauReference,
        deceasedStatus:     result.deceasedStatus,
        safpsFlag:          result.safpsFlag,
        mismatchFlags:      result.mismatchFlags,
      },
    });

    // ── Socket events ──────────────────────────────────────────────────────
    try {
      const io = getIO();
      const room = borrowerId?.toString();

      if (isFatal) {
        io.to(room).emit('bureau-fraud-detected', {
          applicationId,
          deceasedStatus: result.deceasedStatus,
          safpsFlag: result.safpsFlag,
          message: result.deceasedStatus
            ? 'Bureau check: Deceased flag detected'
            : 'Bureau check: SAFPS fraud listing detected',
        });
        io.to(room).emit('bureau-verification-failed', { applicationId, message: result.responseMessage });
      } else if (hasWarnings) {
        io.to(room).emit('bureau-verification-warning', {
          applicationId,
          mismatchFlags: result.mismatchFlags,
          message: 'Bureau verification completed with data mismatches',
        });
      } else {
        io.to(room).emit('bureau-verification-completed', {
          applicationId,
          bureauReference: result.bureauReference,
          message: 'Bureau profile verified successfully',
        });
      }
    } catch {
      // Socket not initialized — non-fatal
    }

    return res.status(200).json({
      success: true,
      message: isFatal
        ? 'Bureau verification failed: fatal fraud indicator detected'
        : hasWarnings
          ? 'Bureau verification completed with warnings'
          : 'Bureau verification successful',
      data: {
        verificationStatus:         isFatal ? 'Failed' : result.verificationStatus,
        bureauReference:            result.bureauReference,
        verifiedFirstName:          result.verifiedFirstName,
        verifiedSurname:            result.verifiedSurname,
        verifiedPhone:              result.verifiedPhone,
        verifiedEmail:              result.verifiedEmail,
        verifiedEmployer:           result.verifiedEmployer,
        verifiedResidentialAddress: result.verifiedResidentialAddress,
        verifiedPostalAddress:      result.verifiedPostalAddress,
        deceasedStatus:  result.deceasedStatus,
        safpsFlag:       result.safpsFlag,
        haVerified:      result.haVerified,
        fraudFlags:      result.fraudFlags,
        addressHistory:  result.addressHistory,
        mismatchFlags:   result.mismatchFlags,
        comparedFields:  result.comparedFields,
        isFatal,
        hasWarnings,
      },
    });
  } catch (error) {
    console.error('[BUREAU Controller Error]:', error.message);

    await writeAuditLog({
      borrowerId,
      applicationId: applicationId || undefined,
      verificationType: 'BUREAU_PROFILE_VERIFICATION',
      status: 'ERROR',
      initiatedBy,
      requestPayload: { idNumber, surname },
      errorMessage: error.message,
    });

    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Bureau verification failed',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. Admin Bureau Override
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/verification/bureau-override/:applicationId
 * Admin only — override bureau mismatches / low-risk flags (not deceased/SAFPS without reason)
 */
exports.overrideBureauController = async (req, res) => {
  const { applicationId } = req.params;
  const { overrideReason } = req.body;
  const adminId = req.user?._id;

  if (!overrideReason?.trim()) {
    return res.status(400).json({ success: false, message: 'overrideReason is required' });
  }

  try {
    const application = await LoanApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    await LoanApplication.findByIdAndUpdate(applicationId, {
      'bureauVerification.verificationStatus': 'Overridden',
      'bureauVerification.overrideReason': overrideReason.trim(),
      'bureauVerification.overrideBy':     adminId,
      'bureauVerification.overrideAt':     new Date(),
    });

    await writeAuditLog({
      borrowerId:       application.borrowerId || adminId,
      applicationId,
      verificationType: 'BUREAU_OVERRIDE',
      status:           'SUCCESS',
      initiatedBy:      adminId,
      requestPayload:   { overrideReason, applicationId },
      responsePayload:  { action: 'BUREAU_MANUAL_OVERRIDE', overrideBy: adminId },
    });

    try {
      const io = getIO();
      io.to(application.borrowerId?.toString()).emit('bureau-verification-completed', {
        applicationId,
        message: 'Bureau verification manually overridden by admin',
        overridden: true,
      });
    } catch {
      // Socket not initialized — non-fatal
    }

    return res.status(200).json({
      success: true,
      message: 'Bureau verification successfully overridden',
      data: { applicationId, overrideReason, overrideAt: new Date() },
    });
  } catch (error) {
    console.error('[Bureau Override Error]:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Override failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. Consumer Credit Report Search (Step 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/verification/consumer-credit-search
 * Requires KYC (step 1) passed and bureau (step 1.5) not rejected.
 * Body: { applicationId, idNumber, passportNumber? }
 */
exports.runCreditAssessmentController = async (req, res) => {
  const initiatedBy = req.user?._id;
  const { applicationId, idNumber, passportNumber, borrowerId: bodyBorrowerId } = req.body;

  const borrowerId = bodyBorrowerId || initiatedBy;

  if (!idNumber) return res.status(400).json({ success: false, message: 'idNumber is required' });

  try {
    // ── Guard: KYC and bureau must be completed ────────────────────────────
    if (applicationId) {
      const app = await LoanApplication.findById(applicationId)
        .select('kycVerification bureauVerification');

      if (app) {
        const kycStatus    = app.kycVerification?.verificationStatus;
        const bureauStatus = app.bureauVerification?.verificationStatus;

        const kycPassed = kycStatus === 'Verified' || kycStatus === 'Overridden';
        if (!kycPassed) {
          return res.status(400).json({
            success: false,
            message: 'Biometric KYC verification must be completed before running credit assessment.',
          });
        }

        if (bureauStatus === 'Rejected') {
          return res.status(400).json({
            success: false,
            message: 'Bureau verification has fatal indicators. Credit assessment cannot proceed.',
          });
        }
      }
    }

    console.log(`[CREDIT Controller] Starting consumer credit search — ID: ${idNumber}`);

    const result = await callConsumerCreditSearch({
      idNumber,
      passportNumber: passportNumber || '',
      reference: applicationId || `CREDIT-${Date.now()}`,
    });

    // ── Persist to LoanApplication ─────────────────────────────────────────
    if (applicationId) {
      await LoanApplication.findByIdAndUpdate(applicationId, {
        'creditAssessment.verificationStatus': result.verificationStatus,
        'creditAssessment.enquiryId':          result.enquiryId,
        'creditAssessment.enquiryResultId':    result.enquiryResultId,
        'creditAssessment.matchedConsumers':   result.matchedConsumers,
        'creditAssessment.reportReference':    result.reportReference,
        'creditAssessment.reportDate':         result.reportDate ? new Date(result.reportDate) : null,
        'creditAssessment.searchSuccess':      result.searchSuccess,
        'creditAssessment.responseCode':       result.responseCode,
        'creditAssessment.completedAt':        new Date(),
      });
    }

    // ── Audit log ──────────────────────────────────────────────────────────
    await writeAuditLog({
      borrowerId,
      applicationId: applicationId || undefined,
      verificationType: 'CREDIT_REPORT_SEARCH',
      status: result.searchSuccess ? 'SUCCESS' : 'FAILED',
      initiatedBy,
      requestPayload: { idNumber, reference: applicationId },
      responsePayload: {
        verificationStatus:  result.verificationStatus,
        enquiryId:           result.enquiryId,
        enquiryResultId:     result.enquiryResultId,
        consumerCount:       result.matchedConsumers.length,
        reportReference:     result.reportReference,
      },
    });

    // ── Socket events ──────────────────────────────────────────────────────
    try {
      const io   = getIO();
      const room = borrowerId?.toString();

      if (result.searchSuccess) {
        io.to(room).emit('credit-search-completed', {
          applicationId,
          enquiryId:       result.enquiryId,
          enquiryResultId: result.enquiryResultId,
          consumerCount:   result.matchedConsumers.length,
          message: 'Consumer credit search completed successfully',
        });
      } else {
        io.to(room).emit('credit-search-failed', {
          applicationId,
          message: 'Consumer credit search failed',
        });
      }
    } catch {
      // Socket not initialized — non-fatal
    }

    return res.status(200).json({
      success: true,
      message: result.verificationStatus === 'Verified'
        ? 'Consumer credit search successful'
        : result.verificationStatus === 'Warning'
          ? 'Credit search completed — no matching consumer profile found'
          : 'Consumer credit search failed',
      data: {
        verificationStatus:  result.verificationStatus,
        enquiryId:           result.enquiryId,
        enquiryResultId:     result.enquiryResultId,
        matchedConsumers:    result.matchedConsumers,
        reportReference:     result.reportReference,
        reportDate:          result.reportDate,
        searchSuccess:       result.searchSuccess,
        responseCode:        result.responseCode,
      },
    });
  } catch (error) {
    console.error('[CREDIT Controller Error]:', error.message);

    await writeAuditLog({
      borrowerId,
      applicationId: applicationId || undefined,
      verificationType: 'CREDIT_REPORT_SEARCH',
      status: 'ERROR',
      initiatedBy,
      requestPayload: { idNumber },
      errorMessage: error.message,
    });

    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Consumer credit search failed',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. Admin Credit Assessment Override
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/verification/credit-search-override/:applicationId
 */
exports.overrideCreditAssessmentController = async (req, res) => {
  const { applicationId } = req.params;
  const { overrideReason } = req.body;
  const adminId = req.user?._id;

  if (!overrideReason?.trim()) {
    return res.status(400).json({ success: false, message: 'overrideReason is required' });
  }

  try {
    const application = await LoanApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    await LoanApplication.findByIdAndUpdate(applicationId, {
      'creditAssessment.verificationStatus': 'Verified',
      'creditAssessment.overrideReason':     overrideReason.trim(),
      'creditAssessment.overriddenBy':       adminId,
      'creditAssessment.overriddenAt':       new Date(),
    });

    await writeAuditLog({
      borrowerId:       application.borrowerId || adminId,
      applicationId,
      verificationType: 'CREDIT_REPORT_OVERRIDE',
      status:           'SUCCESS',
      initiatedBy:      adminId,
      requestPayload:   { overrideReason, applicationId },
      responsePayload:  { action: 'CREDIT_MANUAL_OVERRIDE', overrideBy: adminId },
    });

    return res.status(200).json({
      success: true,
      message: 'Credit assessment successfully overridden',
      data: { applicationId, overrideReason, overriddenAt: new Date() },
    });
  } catch (error) {
    console.error('[Credit Override Error]:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Override failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 13. Consumer Credit Report Result (Step 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/verification/consumer-credit-report/:applicationId
 * Requires Consumer Credit Search (step 3) to be completed with valid enquiry IDs.
 */
exports.fetchConsumerCreditReportController = async (req, res) => {
  const { applicationId } = req.params;
  const initiatedBy       = req.user?._id;

  if (!applicationId) {
    return res.status(400).json({ success: false, message: 'applicationId is required' });
  }

  try {
    // ── Load application and validate prerequisites ────────────────────────
    const app = await LoanApplication.findById(applicationId)
      .select('borrowerId kycVerification creditAssessment consumerCreditReport');

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const kycStatus = app.kycVerification?.verificationStatus;
    const kycPassed = kycStatus === 'Verified' || kycStatus === 'Overridden';
    if (!kycPassed) {
      return res.status(400).json({
        success: false,
        message: 'Biometric KYC verification must be completed before fetching the credit report.',
      });
    }

    const creditSearch = app.creditAssessment;
    const enquiryId       = creditSearch?.enquiryId;
    const enquiryResultId = creditSearch?.enquiryResultId;

    if (!enquiryId || !enquiryResultId) {
      return res.status(400).json({
        success: false,
        message: 'Consumer Credit Search must be completed with valid Enquiry IDs before fetching the full report.',
      });
    }

    const borrowerId = app.borrowerId || initiatedBy;

    console.log(`[CREDIT-RESULT Controller] Fetching full report — EnquiryID: ${enquiryId}`);

    // ── Call Datanamix Consumer Result API ────────────────────────────────
    const result = await callConsumerCreditResult({
      enquiryId,
      enquiryResultId,
      clientReference: applicationId,
    });

    const verificationStatus = result.success ? 'Verified' : 'Failed';

    // ── Persist to LoanApplication ─────────────────────────────────────────
    await LoanApplication.findByIdAndUpdate(applicationId, {
      'consumerCreditReport.verificationStatus':  verificationStatus,
      'consumerCreditReport.completedAt':         new Date(),
      'consumerCreditReport.reportReference':     result.reportReference,
      'consumerCreditReport.reportDate':          result.reportDate,
      'consumerCreditReport.enquiryId':           enquiryId,
      'consumerCreditReport.enquiryResultId':     enquiryResultId,
      'consumerCreditReport.scoring':             result.scoring,
      'consumerCreditReport.debtSummary':         result.debtSummary,
      'consumerCreditReport.fraudIndicators':     result.fraudIndicators,
      'consumerCreditReport.underwriting':        result.underwriting,
      'consumerCreditReport.consumerDetails':     result.consumerDetails,
      'consumerCreditReport.accountSummary':      result.accountSummary,
      'consumerCreditReport.adverseInformation':  result.adverseInformation,
      'consumerCreditReport.properties':          result.properties,
      'consumerCreditReport.directorships':       result.directorships,
      'consumerCreditReport.addressHistory':      result.addressHistory,
      'consumerCreditReport.contactHistory':      result.contactHistory,
      'consumerCreditReport.emailHistory':        result.emailHistory,
      'consumerCreditReport.employmentHistory':   result.employmentHistory,
      'consumerCreditReport.enquiryHistory':      result.enquiryHistory,
      'consumerCreditReport.monthlyPaymentHistory': result.monthlyPaymentHistory,
      'consumerCreditReport.pdfReport':           result.pdfReport,
      'consumerCreditReport.rawResponse':         result.rawResponse,
    });

    // ── Audit log ──────────────────────────────────────────────────────────
    await writeAuditLog({
      borrowerId,
      applicationId,
      verificationType: 'CREDIT_REPORT_RESULT',
      status: result.success ? 'SUCCESS' : 'FAILED',
      initiatedBy,
      requestPayload: { enquiryId, enquiryResultId, applicationId },
      responsePayload: {
        verificationStatus,
        score:          result.scoring?.finalScore,
        riskCategory:   result.underwriting?.riskCategory,
        decision:       result.underwriting?.level,
        judgements:     result.debtSummary?.judgementCount,
        defaults:       result.debtSummary?.defaultListingCount,
        reportReference: result.reportReference,
      },
    });

    // ── Socket events ──────────────────────────────────────────────────────
    try {
      const io   = getIO();
      const room = borrowerId?.toString();

      io.to(room).emit('credit-report-completed', {
        applicationId,
        score:        result.scoring?.finalScore,
        riskCategory: result.underwriting?.riskCategory,
        decision:     result.underwriting?.level,
        message:      'Full consumer credit report retrieved',
      });

      if (result.underwriting?.level === 'DECLINE') {
        io.to(room).emit('credit-report-decline-flag', {
          applicationId,
          reasons: result.underwriting.reasons,
        });
      }
    } catch {
      // Socket not initialized — non-fatal
    }

    return res.status(200).json({
      success: true,
      message: 'Consumer credit report retrieved successfully',
      data: {
        verificationStatus,
        reportReference:    result.reportReference,
        reportDate:         result.reportDate,
        scoring:            result.scoring,
        debtSummary:        result.debtSummary,
        fraudIndicators:    result.fraudIndicators,
        underwriting:       result.underwriting,
        consumerDetails:    result.consumerDetails,
        accountSummary:     result.accountSummary,
        adverseInformation: result.adverseInformation,
        properties:         result.properties,
        directorships:      result.directorships,
        addressHistory:     result.addressHistory,
        employmentHistory:  result.employmentHistory,
        enquiryHistory:     result.enquiryHistory,
        monthlyPaymentHistory: result.monthlyPaymentHistory,
      },
    });
  } catch (error) {
    console.error('[CREDIT-RESULT Controller Error]:', error.message);

    // Attempt to look up borrowerId for audit even on failure
    const failApp = await LoanApplication.findById(applicationId).select('borrowerId').catch(() => null);
    const fallbackBorrowerId = failApp?.borrowerId || initiatedBy;

    await writeAuditLog({
      borrowerId:       fallbackBorrowerId,
      applicationId,
      verificationType: 'CREDIT_REPORT_RESULT_FAILED',
      status:           'ERROR',
      initiatedBy,
      requestPayload:   { applicationId },
      errorMessage:     error.message,
    });

    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch consumer credit report',
    });
  }
};
