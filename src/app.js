const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middlewares/errorMiddleware');

// Route files
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminAgentRoutes = require('./routes/admin/agentRoutes');
const agentMyClientsRoutes = require('./routes/agent/myClientsRoutes');
const agentEarningsRoutes = require('./routes/agent/earningsRoutes');
const adminBorrowerRoutes = require('./routes/adminBorrowerRoutes');
const borrowerDashboardRoutes = require('./routes/borrowerRoutes');
const staffRoutes = require('./routes/staffRoutes');
const repaymentRoutes = require('./routes/repaymentRoutes');
const agentRoutes = require('./routes/agentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const loanApplicationRoutes = require('./routes/loanApplicationRoutes');
const activeLoanRoutes = require('./routes/admin/activeLoanRoutes');
const paymentRoutes = require('./routes/admin/paymentRoutes');
const duePaymentRoutes = require('./routes/admin/duePaymentRoutes');
const nupayRoutes = require('./routes/admin/nupayRoutes');
const reportRoutes = require('./routes/admin/reportRoutes');
const communicationRoutes = require('./routes/admin/communicationRoutes');
const settingsRoutes = require('./routes/admin/settingsRoutes');
const notificationRoutes = require('./routes/admin/notificationRoutes');
const navbarNotificationRoutes = require('./routes/admin/navbarNotificationRoutes');
const adminProfileRoutes = require('./routes/admin/profileRoutes');
const adminDashboardRoutes = require('./routes/admin/dashboardRoutes');
const staffLoanRequestRoutes = require('./routes/staff/loanRequestRoutes');
const staffLoanReviewRoutes = require('./routes/staff/loanReviewRoutes');
const staffPaymentVerificationRoutes = require('./routes/staff/paymentVerificationRoutes');
const staffCommunicationRoutes = require('./routes/staff/communicationRoutes');
const staffProfileRoutes = require('./routes/staff/profileRoutes');
const staffNotificationRoutes = require('./routes/staff/notificationRoutes');
const staffDashboardRoutes = require('./routes/staff/dashboardRoutes');
const borrowerPaymentRoutes = require('./routes/borrower/paymentRoutes');
const agentCommunicationRoutes = require('./routes/agent/communicationRoutes');
const agentNotificationRoutes = require('./routes/agent/notificationRoutes');
const agentProfileRoutes = require('./routes/agent/profileRoutes');
const agentDashboardRoutes = require('./routes/agent/dashboardRoutes');
const agentFollowUpRoutes = require('./routes/agent/followUpRoutes');
const borrowerApplyLoanRoutes = require('./routes/borrowerLoanRoutes');
const verificationRoutes = require('./routes/verification.routes');
const agreementRoutes = require('./modules/agreementSigning/routes/agreementSigning.routes');
const validationRoutes = require('./routes/validationRoutes');
const app = express();
// Body parser — 10 MB limit supports base64 image payloads from KYC flows
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Cookie parser
app.use(cookieParser());
// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
// Set security headers
app.use(helmet());
// Enable CORS
app.use(cors());
// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 2000, // Increased scale to support rapid real-time message flows and dashboard syncing
  message: 'Too many requests from this IP, please try again after 10 minutes'
});
app.use(limiter);
// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/admin/borrowers', adminBorrowerRoutes);
app.use('/api/admin/agents', adminAgentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/staff', staffRoutes);
app.use('/api/admin/loan-applications', loanApplicationRoutes);
app.use('/api/admin/active-loans', activeLoanRoutes);
app.use('/api/admin/payments', paymentRoutes);
app.use('/api/admin/due-payments', duePaymentRoutes);
app.use('/api/admin/nupay', nupayRoutes);

app.use('/api/admin/reports', reportRoutes);
app.use('/api/admin/communications', communicationRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin/notifications', notificationRoutes);
app.use('/api/admin/navbar-notifications', navbarNotificationRoutes);
app.use('/api/admin/profile', adminProfileRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/staff/loan-requests', staffLoanRequestRoutes);
app.use('/api/staff/loan-review', staffLoanReviewRoutes);
app.use('/api/staff/payment-verification', staffPaymentVerificationRoutes);
app.use('/api/staff/communications', staffCommunicationRoutes);
app.use('/api/staff/profile', staffProfileRoutes);
app.use('/api/staff/notifications', staffNotificationRoutes);
app.use('/api/staff/dashboard', staffDashboardRoutes);
app.use('/api/borrower/payments', borrowerPaymentRoutes);
app.use('/api/borrower/communications', require('./routes/borrower/communicationRoutes'));
app.use('/api/borrower/apply-loan', borrowerApplyLoanRoutes);
app.use('/api/borrower', borrowerDashboardRoutes);

app.use('/api/agent/my-clients', agentMyClientsRoutes);
app.use('/api/agent/earnings', agentEarningsRoutes);
app.use('/api/agent/communications', agentCommunicationRoutes);
app.use('/api/agent/notifications', agentNotificationRoutes);
app.use('/api/agent/profile', agentProfileRoutes);
app.use('/api/agent/dashboard', agentDashboardRoutes);
app.use('/api/agent/follow-ups', agentFollowUpRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/repayments', repaymentRoutes);


app.use('/api/verification', verificationRoutes);
app.use('/api/agreement', agreementRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/validation-rules', validationRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Point.47 LMS API' });
});

// Error handler
app.use(errorHandler);

module.exports = app;
