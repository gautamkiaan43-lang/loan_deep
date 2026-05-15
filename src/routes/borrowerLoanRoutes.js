const express = require('express');
const router = express.Router();
const { 
  getLoanEstimate, 
  uploadOnly,
  submitFullApplication,
  getApplicationStatus
} = require('../controllers/borrowerLoanController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

router.get('/estimate', getLoanEstimate);
router.post('/upload', upload.single('file'), uploadOnly);
router.post('/submit-full', submitFullApplication);
router.get('/status/:applicationId', getApplicationStatus);

module.exports = router;
