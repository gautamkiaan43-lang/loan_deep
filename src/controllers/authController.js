const User = require('../models/User');
const Borrower = require('../models/Borrower');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const generateToken = require('../utils/generateToken');

// @desc    Register a new borrower
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, confirmPassword } = req.body;

  // Basic validation
  if (!fullName || !email || !phone || !password || !confirmPassword) {
    return sendError(res, 'Please provide all required fields', 400);
  }

  if (password !== confirmPassword) {
    return sendError(res, 'Passwords do not match', 400);
  }

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    return sendError(res, 'User already exists', 400);
  }

  // Create user
  const user = await User.create({
    fullName,
    email,
    phone,
    password,
    role: 'borrower', // Registration is only for borrowers as per requirements
  });

  if (user) {
    // Create borrower profile (linked to user)
    const borrowerProfile = await Borrower.create({ 
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phone,
      accountStatus: 'Active'
    });

    // Create admin real-time notification
    try {
      const { createNotification } = require('../utils/notificationHelper');
      await createNotification({
        title: 'Borrower Registered',
        message: `A new borrower profile has been registered for ${user.fullName}.`,
        notificationType: 'Borrower Registered',
        priority: 'Normal',
        borrowerId: borrowerProfile._id
      });
    } catch (notifErr) {
      console.error('Failed to log borrower registration notification:', notifErr.message);
    }

    const token = generateToken(user._id, user.role);

    sendSuccess(res, 'Borrower registered successfully', {
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        operationalStatus: user.operationalStatus,
        profilePhoto: user.profilePhoto,
        phoneNumber: user.phoneNumber,
        primaryBranch: user.primaryBranch,
      },
      token,
    }, 201);
  } else {
    sendError(res, 'Invalid user data', 400);
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  // Validation
  if (!email || !password || !role) {
    return sendError(res, 'Please provide email, password and role', 400);
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return sendError(res, 'Invalid credentials', 401);
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return sendError(res, 'Invalid credentials', 401);
  }

  // Check if role matches
  if (user.role !== role) {
    return sendError(res, `Unauthorized: Your account does not have ${role} privileges`, 403);
  }

  // Check if user is active
  if (!user.isActive) {
    // If it's a staff/agent and they are suspended, provide the specific message
    const message = (user.role === 'staff' || user.role === 'agent') 
      ? 'Your account has been suspended' 
      : 'Your account is inactive. Please contact support.';
    return sendError(res, message, 403);
  }

  if (user.isFrozen) {
    if (user.statusReason === 'Your account has been suspended') {
      return sendError(res, 'Your account has been suspended', 403);
    }
    const reason = user.statusReason ? `: ${user.statusReason}` : '';
    return sendError(res, `Your account is frozen${reason}. Please contact support to unfreeze.`, 403);
  }

  if (user.isBlacklisted) {
    const reason = user.statusReason ? `: ${user.statusReason}` : '';
    return sendError(res, `Access Denied: Your account has been blacklisted${reason}.`, 403);
  }

  if (user.isBlacklisted) {
    return sendError(res, 'Your account is blacklisted.', 403);
  }

  const token = generateToken(user._id, user.role);

  sendSuccess(res, 'Login successful', {
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
      phoneNumber: user.phoneNumber,
      primaryBranch: user.primaryBranch,
    },
    token,
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  sendSuccess(res, 'User data retrieved', user);
});
