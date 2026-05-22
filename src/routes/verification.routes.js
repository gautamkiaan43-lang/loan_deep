/**
 * Datanamix Verification Routing System
 * Secures routing bounds and validates payloads prior to launching checks.
 */

const express = require('express');
const router = express.Router();

const {
  verifyIdentityController,
  verifyFaceLivenessController,
  verifyBankController,
  verifyCreditController,
  verifyPhoneController,
  verifyAMLController,
  verifyBorrowerKYCController,
  overrideKYCController,
  verifyAddressProfileController,
  overrideBureauController,
  runCreditAssessmentController,
  overrideCreditAssessmentController,
  fetchConsumerCreditReportController,
} = require('../controllers/verification.controller');

const { protectVerification } = require('../middleware/auth.middleware');
const { requireConsent, validateProfileData } = require('../middleware/verification.middleware');
const multer = require('multer');

// Memory-storage multer for KYC image uploads (no disk I/O, consistent with uploadMiddleware)
const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Apply protection to all integration routes
router.use(protectVerification);

/**
 * @route   POST /api/verification/identity
 * @desc    Validate borrower's DHA ID number & match photo
 * @access  Private
 */
router.post(
  '/identity',
  validateProfileData(['borrowerId', 'idNumber', 'fullName']),
  verifyIdentityController
);

/**
 * @route   POST /api/verification/face-liveness
 * @desc    Validate biometric liveness session (FaceTec 3D)
 * @access  Private
 */
router.post(
  '/face-liveness',
  validateProfileData(['borrowerId', 'faceScan', 'sessionId']),
  verifyFaceLivenessController
);

/**
 * @route   POST /api/verification/bank
 * @desc    Account Holder Verification Advanced (AHV) checks
 * @access  Private
 */
router.post(
  '/bank',
  validateProfileData(['borrowerId', 'bankName', 'accountNumber', 'idNumber', 'accountHolderName']),
  verifyBankController
);

/**
 * @route   POST /api/verification/credit
 * @desc    Pull Universal Consumer Credit Bureau Report
 * @access  Private
 */
router.post(
  '/credit',
  requireConsent, // Mandate explicit consent check on DB
  validateProfileData(['borrowerId', 'idNumber', 'fullName', 'consentAccepted']),
  verifyCreditController
);

/**
 * @route   POST /api/verification/phone
 * @desc    Carrier Identity phone matching checks
 * @access  Private
 */
router.post(
  '/phone',
  validateProfileData(['borrowerId', 'phoneNumber', 'idNumber', 'fullName']),
  verifyPhoneController
);

/**
 * @route   POST /api/verification/aml
 * @desc    PEP, Sanctions lists, and Crime data compliance lookup
 * @access  Private
 */
router.post(
  '/aml',
  validateProfileData(['borrowerId', 'idNumber', 'fullName']),
  verifyAMLController
);

/**
 * @route   POST /api/verification/profile-id-photo-match
 * @desc    KYC: Datanamix Profile Plus ID Photo Match (Offline) — primary KYC gate
 * @access  Private — multipart/form-data: idFrontImage required, selfieImage + idBackImage optional
 */
router.post(
  '/profile-id-photo-match',
  kycUpload.fields([
    { name: 'idFrontImage', maxCount: 1 },
    { name: 'selfieImage',  maxCount: 1 },
    { name: 'idBackImage',  maxCount: 1 },
  ]),
  verifyBorrowerKYCController
);

/**
 * @route   PUT /api/verification/kyc-override/:applicationId
 * @desc    Admin manual override of a failed KYC — always creates an audit log
 * @access  Private (admin only enforced at controller level via req.user)
 */
router.put('/kyc-override/:applicationId', overrideKYCController);

/**
 * @route   POST /api/verification/address-plus-profile-idv
 * @desc    Bureau: Address Plus Profile IDV — Step 1.5 after biometric KYC
 * @access  Private — JSON body: { applicationId, idNumber, surname, ... }
 */
router.post('/address-plus-profile-idv', verifyAddressProfileController);

/**
 * @route   PUT /api/verification/bureau-override/:applicationId
 * @desc    Admin override of bureau mismatch / low-risk flags
 * @access  Private (admin only enforced at controller level)
 */
router.put('/bureau-override/:applicationId', overrideBureauController);

/**
 * @route   POST /api/verification/consumer-credit-search
 * @desc    Step 2: Datanamix Consumer Credit Search — generates EnquiryID + EnquiryResultID
 * @access  Private — requires KYC passed + bureau not rejected
 */
router.post('/consumer-credit-search', runCreditAssessmentController);

/**
 * @route   PUT /api/verification/credit-search-override/:applicationId
 * @desc    Admin override of a failed/warning credit assessment
 * @access  Private (admin only enforced at controller level)
 */
router.put('/credit-search-override/:applicationId', overrideCreditAssessmentController);

/**
 * @route   POST /api/verification/consumer-credit-report/:applicationId
 * @desc    Step 4: Fetch full Datanamix Consumer Credit Report Result
 * @access  Private — requires credit search (step 3) with valid enquiry IDs
 */
router.post('/consumer-credit-report/:applicationId', fetchConsumerCreditReportController);

module.exports = router;
