import bcrypt from 'bcrypt';
import User, { UserType } from '../models/User';
import { CustomResponseType } from '../types';
import { AddressType } from '../types/userTypes';

/**
 * Creates a new user.
 * @param userData - The data of the user to create.
 * @returns A promise that resolves to a custom response containing the created user.
 */
const createUser = async (userData: UserType): Promise<CustomResponseType<UserType>> => {
  try {
    const user = new User(userData);
    await user.save();
    return {
      message: 'User created successfully',
      data: user,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Retrieves a user by their ID.
 * @param userId - The ID of the user to retrieve.
 * @returns A promise that resolves to a custom response containing the user.
 */
const getUserById = async (userId: string): Promise<CustomResponseType<UserType>> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'User retrieved successfully',
      data: user,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates user details.
 * @param userId - The ID of the user to update.
 * @param updateData - The data to update.
 * @returns A promise that resolves to a custom response containing the updated user.
 */
const updateUser = async (userId: string, updateData: Partial<UserType>): Promise<CustomResponseType<UserType>> => {
  try {
    const user = await User.findByIdAndUpdate(userId, updateData);
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'User updated successfully',
      data: user,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes a user.
 * @param userId - The ID of the user to delete.
 * @returns A promise that resolves to a custom response indicating the result.
 */
const deleteUser = async (userId: string): Promise<CustomResponseType<null>> => {
  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'User deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Changes the user's password.
 * @param userId - The ID of the user to change the password for.
 * @param currentPassword - The current password of the user.
 * @param newPassword - The new password to set.
 * @returns A promise that resolves to a custom response indicating the result.
 */
const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<CustomResponseType<null>> => {
  try {
    const user = await User.findById(userId).select('password');
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    if (!user.password) {
      return {
        message: 'Password not set',
        data: null,
        code: 400,
      };
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return {
        message: 'Current password is incorrect',
        data: null,
        code: 400,
      };
    }
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    return {
      message: 'Password changed successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Manages user addresses (add, update, delete).
 * @param userId - The ID of the user to manage addresses for.
 * @param addressData - The address data to manage.
 * @param action - The action to perform (add, update, delete).
 * @returns A promise that resolves to a custom response indicating the result.
 */
const manageAddress = async (
  userId: string,
  addressData: AddressType,
  action: 'add' | 'update' | 'delete'
): Promise<CustomResponseType<AddressType[]>> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    if (action === 'add') {
      user.address.push(addressData);
    } else if (action === 'update') {
      const index = user.address.findIndex((addr) => addr._id.toString() === addressData._id);
      if (index !== -1) {
        user.address[index] = addressData;
      } else {
        return {
          message: 'Address not found',
          data: null,
          code: 404,
        };
      }
    } else if (action === 'delete') {
      user.address = user.address.filter((addr) => addr._id.toString() !== addressData._id);
    }
    await user.save();
    return {
      message: 'Address managed successfully',
      data: user.address,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Applies a coupon to the user's cart.
 * @param userId - The ID of the user to apply the coupon for.
 * @param couponCode - The coupon code to apply.
 * @returns A promise that resolves to a custom response indicating the result.
 */
const applyCoupon = async (userId: string, couponCode: string): Promise<CustomResponseType<null>> => {
  try {
    // Implement coupon application logic here
    return {
      message: 'Coupon applied successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

const UserService = {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  manageAddress,
  applyCoupon,
};
export default UserService;
