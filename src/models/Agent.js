const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const agentSchema = new mongoose.Schema(
  {
    // Auth related (linked to User model but also stored here as requested)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fullName: {
      type: String,
      required: [true, 'Please add a full name'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      select: false,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please add a phone number'],
      unique: true,
    },

    // Personal Details
    idNumber: {
      type: String,
      required: [true, 'Please add an ID number'],
      unique: true,
    },
    physicalAddress: {
      type: String,
      required: [true, 'Please add a physical address'],
    },
    profilePhoto: {
      type: String,
      default: null,
    },
    profilePhotoFileId: {
      type: String,
      default: null,
    },

    // Employment Details
    assignedRegion: {
      type: String,
      required: [true, 'Please assign a region'],
    },
    joiningDate: {
      type: Date,
      required: [true, 'Please add a joining date'],
    },
    reportingManager: {
      type: String,
      required: [true, 'Please add a reporting manager'],
    },
    employeeId: {
      type: String,
      unique: true,
    },
    role: {
      type: String,
      enum: ['Agent', 'Field Agent', 'Recovery Agent', 'Senior Agent'],
      default: 'Field Agent',
    },

    // Commission Setup
    baseCommission: {
      type: Number,
      required: [true, 'Please add base commission percentage'],
      min: 0,
      max: 100,
    },
    recoveryBonus: {
      type: Number,
      required: [true, 'Please add recovery bonus percentage'],
      min: 0,
      max: 100,
    },
    commissionTier: {
      type: String,
      required: [true, 'Please add commission tier'],
    },

    // System Status & Metrics
    accountStatus: {
      type: String,
      enum: ['Active', 'Suspended', 'Inactive'],
      default: 'Active',
    },
    assignedBorrowers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Borrower',
      },
    ],
    totalCollections: {
      type: Number,
      default: 0,
    },
    totalCommissionEarned: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    internalNotes: {
      type: String,
      default: '',
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password
agentSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Pre-save hook to generate unique employeeId
agentSchema.pre('save', async function () {
  if (!this.employeeId) {
    try {
      const lastAgent = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
      let nextNumber = 1001;
      
      if (lastAgent && lastAgent.employeeId) {
        const parts = lastAgent.employeeId.split('-');
        if (parts.length === 2) {
          const lastNumber = parseInt(parts[1]);
          if (!isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
          }
        }
      }
      
      this.employeeId = `AGT-${nextNumber}`;
    } catch (error) {
      throw error;
    }
  }
});


module.exports = mongoose.model('Agent', agentSchema);

