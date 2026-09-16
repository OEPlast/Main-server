import mongoose, { InferSchemaType } from 'mongoose';

const addressSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: '"Please enter a address firstname.',
  },
  lastName: {
    type: String,
    required: '"Please enter a address lastname.',
  },
  phoneNumber: {
    type: String,
    required: '"Please enter a address phone number.',
  },
  address1: {
    type: String,
    required: '"Please enter a address1.',
  },
  address2: {
    type: String,
  },
  city: {
    type: String,
    required: '"Please enter a address city.',
  },
  zipCode: {
    type: String,
    required: '"Please enter a address zipCode.',
  },
  state: {
    type: String,
    required: '"Please enter a address state.',
  },
  lga: {
    type: String,
    required: '"Please enter a address LGA.',
  },
  country: {
    type: String,
    required: '"Please enter a address country.',
  },
  active: {
    type: Boolean,
    default: false,
  },
  latitude: {
    type: Number,
  },
  longitude: {
    type: Number,
  },
});
const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: 'Please enter your first name.',
      default: '',
    },
    lastName: {
      type: String,
      required: 'Please enter your last name.',
      default: '',
    },
    // Name field for NextAuth compatibility (combines firstName + lastName)
    name: {
      type: String,
    },
    email: {
      type: String,
      required: [true, 'Please enter your email address.'],
      trim: true,
      unique: true,
    },
    dob: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      // required: '"Please enter a password.',
    },
    role: {
      type: String,
      enum: ['owner', 'user', 'employee'],
      default: 'user',
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    image: {
      type: String,
      default: 'https://res.cloudinary.com/dmhcnhtng/image/upload/v1664642478/992490_b0iqzq.png',
    },
    miniImage: {
      type: String,
      required: false, // Minified version of user image (optional for backward compatibility)
    },
    emailVerified: {
      type: Date,
      default: null,
    },
    defaultPaymentMethod: {
      type: String,
      default: '',
    },
    suspended: {
      type: Boolean,
      default: false,
    },
    // Copied into every JWT as `tv`. Incrementing it revokes every token issued before: tokens
    // are otherwise valid for 7 days, so a suspension or a password reset used to leave any
    // stolen or old session working until it expired on its own.
    tokenVersion: {
      type: Number,
      default: 0,
    },
    // A customer record created by guest checkout: no password, never logged in. Orders and
    // transactions point at it like any other user, so emails, admin views and per-customer
    // coupon limits keep working. Cleared once the owner proves the email is theirs — setting a
    // password through the emailed reset code, or signing in with a provider that verified it.
    isGuest: {
      type: Boolean,
      default: false,
      index: true,
    },
    address: [addressSchema],
    // Self-service account deletion (services/users/accountDeletion.ts). Requesting sets both
    // dates; the customer can cancel until `deletionScheduledFor`, when cron/accountDeletion
    // anonymises the account and sets `deletedAt`.
    deletionRequestedAt: { type: Date, default: null },
    deletionScheduledFor: { type: Date, default: null, index: true },
    deletedAt: { type: Date, default: null },
    notifications: {
      type: Boolean,
      default: true,
    },
    // Email opt-out state. Applies to marketing mail only — order confirmations, receipts,
    // shipping updates and security notices are transactional and are always sent.
    //
    // Added because every email footer carried an "unsubscribe" link pointing at href="#",
    // which is both useless to the recipient and a bulk-sender compliance problem.
    emailPreferences: {
      marketing: {
        type: Boolean,
        default: true,
      },
      unsubscribedAt: {
        type: Date,
        default: null,
      },
      /** When the customer last opted in (newsletter form or account settings). */
      subscribedAt: {
        type: Date,
        default: null,
      },
      /** Where that opt-in came from, e.g. `footer`, `account`. */
      source: {
        type: String,
        default: null,
      },
    },
    // Virtual fields for NextAuth relations (handled via populate)
    // accounts: referenced by Account model
    // sessions: referenced by Session model
  },
  {
    timestamps: true,
  }
);

// Virtual field for accounts
userSchema.virtual('accounts', {
  ref: 'Account',
  localField: '_id',
  foreignField: 'userId',
});

// Virtual field for sessions
userSchema.virtual('sessions', {
  ref: 'Session',
  localField: '_id',
  foreignField: 'userId',
});

// Middleware to auto-populate name field from firstName and lastName
userSchema.pre('save', function (next) {
  if (this.firstName || this.lastName) {
    this.name = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }
  next();
});

// Enable virtuals in toJSON and toObject
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

export type UserType = InferSchemaType<typeof userSchema>;
const User = mongoose.model('User', userSchema);

export default User;
