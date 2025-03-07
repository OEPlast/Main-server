import { ObjectId } from 'mongoose';

export interface AddressType {
  _id?: ObjectId;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zipCode?: string;
  state?: string;
  country?: string;
  active?: boolean;
}

export interface WishlistType {
  product: ObjectId;
  style?: string;
}

export interface UserType {
  _id?: ObjectId;
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  role?: 'owner' | 'user' | 'manager' | 'employee';
  image?: string;
  emailVerified?: boolean;
  defaultPaymentMethod?: string;
  address?: AddressType[];
  wishlist?: WishlistType[];
}
