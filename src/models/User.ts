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
  country: {
    type: String,
    required: '"Please enter a address country.',
  },
  active: {
    type: Boolean,
    default: false,
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
    address: [addressSchema],
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
