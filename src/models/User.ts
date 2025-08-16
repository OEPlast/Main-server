import mongoose, { InferSchemaType } from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: 'Please enter your first name.',
    },
    lastName: {
      type: String,
      required: 'Please enter your last name.',
    },
    email: {
      type: String,
      required: [true, 'Please enter your email address.'],
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: '"Please enter a password.',
    },
    role: {
      type: String,
      enum: ['owner', 'user', 'manager', 'employee'],
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
    emailVerified: {
      type: Boolean,
      default: false,
    },
    defaultPaymentMethod: {
      type: String,
      default: '',
    },
    suspended: {
      type: Boolean,
      default: false,
    },
    address: [
      {
        firstName: {
          type: String,
        },
        lastName: {
          type: String,
        },
        phoneNumber: {
          type: String,
        },
        address1: {
          type: String,
        },
        address2: {
          type: String,
        },
        city: {
          type: String,
        },
        zipCode: {
          type: String,
        },
        state: {
          type: String,
        },
        country: {
          type: String,
        },
        active: {
          type: Boolean,
          default: false,
        },
      },
    ],
    notifications: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export type UserType = InferSchemaType<typeof userSchema>;
const User = mongoose.model('User', userSchema);

export default User;
