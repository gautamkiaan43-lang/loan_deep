const express = require('express');
const router = express.Router();
const { 
  createBorrower, 
  getAllBorrowers, 
  getBorrowerById, 
  updateBorrower, 
  freezeBorrower, 
  blacklistBorrower, 
  deleteBorrower 
} = require('../controllers/borrowerController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// All routes are protected and for admin/staff
router.use(protect);
router.use(authorize('admin', 'staff'));

router.get('/', getAllBorrowers);
router.post('/create', upload.single('profilePhoto'), createBorrower);
router.get('/:id', getBorrowerById);
router.put('/:id', upload.single('profilePhoto'), updateBorrower);
router.patch('/:id/freeze', freezeBorrower);
router.patch('/:id/blacklist', blacklistBorrower);
router.delete('/:id', deleteBorrower);

module.exports = router;
