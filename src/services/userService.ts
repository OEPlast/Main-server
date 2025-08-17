import passwordLib from '@/lib/password';
import User, { UserType } from '../models/User';
import { CustomResponsePromise, CustomResponseType } from '@/types';
import Coupon, { CouponType } from '@/models/Coupon';
import AnalyticsService from './MainAnalyticsService';
import mongoose from 'mongoose';

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
    const isMatch = await passwordLib.comparePassword(user.password, currentPassword);
    if (!isMatch) {
      return {
        message: 'Current password is incorrect',
        data: null,
        code: 400,
      };
    }
    user.password = await passwordLib.hashPassword(newPassword);
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
 * Applies a coupon to the user's cart.
 * @param userId - The ID of the user to apply the coupon for.
 * @param couponCode - The coupon code to apply.
 * @returns A promise that resolves to a custom response indicating the result.
 */
const applyCoupon = async (userId: string, couponCode: string): CustomResponsePromise<CouponType> => {
  try {
    const currentDate = new Date();
    const coupon = await Coupon.findOne({
      coupon: couponCode,
      deleted: { $ne: true },
      active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
    }).select({ coupon: 1, discount: 1, couponType: 1, allowedUser: 1, usedBy: 1, timesUsed: 1 });
    if (!coupon) {
      return {
        message: 'Coupon not found or not valid',
        data: null,
        code: 404,
      };
    }

    if (coupon.couponType === 'one-off') {
      if (coupon.timesUsed && coupon.timesUsed > 0) {
        return { message: 'Coupon already used', data: null, code: 400 };
      }
    }

    if (coupon.couponType === 'one-off-user') {
      const usedBy = (coupon.usedBy || []).map((u) => u.toString());
      if (usedBy.includes(userId)) {
        return { message: 'Coupon already used by this user', data: null, code: 400 };
      }
    }

    if (coupon.couponType === 'one-off-for-one-person') {
      if (!coupon.allowedUser || coupon.allowedUser.toString() !== userId) {
        return { message: 'Coupon not allowed for this user', data: null, code: 403 };
      }
      if (coupon.timesUsed && coupon.timesUsed > 0) {
        return { message: 'Coupon already used', data: null, code: 400 };
      }
    }

    // Track coupon usage for analytics (async)
    AnalyticsService.trackCouponUsed(coupon._id.toString(), userId).catch((err) =>
      console.error('Failed to track coupon usage analytics:', err)
    );

    return {
      message: 'Coupon applied successfully',
      data: coupon,
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
 * Get user profile (excludes sensitive data)
 * @param userId - The ID of the user to retrieve profile for.
 * @returns A promise that resolves to a custom response containing the user profile.
 */
const getUserProfile = async (userId: string): Promise<CustomResponseType<Partial<UserType>>> => {
  try {
    const user = await User.findById(userId).select('-password -resetCode -isVerified');
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'User profile retrieved successfully',
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
 * Update user profile (only allowed fields: notifications, image, country, dob, firstName, lastName)
 * @param userId - The ID of the user to update.
 * @param updateData - The profile data to update.
 * @returns A promise that resolves to a custom response containing the updated user profile.
 */
const updateUserProfile = async (
  userId: string,
  updateData: Partial<UserType>
): Promise<CustomResponseType<Partial<UserType>>> => {
  try {
    // Only allow specific fields to be updated
    const { notifications, image, country, dob, firstName, lastName } = updateData;
    const allowedUpdateData: Partial<UserType> = {};

    if (firstName !== undefined) allowedUpdateData.firstName = firstName;
    if (lastName !== undefined) allowedUpdateData.lastName = lastName;
    if (notifications !== undefined) allowedUpdateData.notifications = notifications;
    if (image !== undefined) allowedUpdateData.image = image;
    if (country !== undefined) allowedUpdateData.country = country;
    if (dob !== undefined) allowedUpdateData.dob = dob;

    const user = await User.findByIdAndUpdate(userId, allowedUpdateData, { new: true }).select(
      '-password -resetCode -isVerified'
    );

    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'User profile updated successfully',
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
 * Add a new address to user
 * @param userId - The ID of the user to add address for.
 * @param addressData - The address data to add.
 * @returns A promise that resolves to a custom response containing the updated addresses.
 */
const addAddress = async (
  userId: string,
  addressData: UserType['address'][0]
): Promise<CustomResponseType<UserType['address'][0]>> => {
  const session = await User.startSession();
  session.startTransaction();

  try {
    if (!addressData.active) {
      await User.updateOne({ _id: userId }, { $push: { address: addressData } }, { session });
    } else {
      await User.updateOne({ _id: userId }, { $set: { 'address.$[].active': false } }, { session });
      await User.updateOne({ _id: userId }, { $push: { address: addressData } }, { session });
    }
    await session.commitTransaction();
    session.endSession();

    return {
      message: 'Address added successfully',
      data: addressData,
      code: 201,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Update a specific address
 * @param userId - The ID of the user.
 * @param addressId - The ID of the address to update.
 * @param updateData - The address data to update.
 * @returns A promise that resolves to a custom response containing the updated addresses.
 */
type UpdateAddressType = Partial<UserType['address'][0]>;
const updateAddress = async (
  userId: string,
  addressId: string,
  updateData: UpdateAddressType
): Promise<CustomResponseType<UserType['address']>> => {
  try {
    const activating = updateData.active === true;
    if (activating) {
      // Use aggregation pipeline to deactivate others and update the target
      const pipelineUpdate = await User.updateOne({ _id: userId }, [
        {
          $set: {
            address: {
              $map: {
                input: { $ifNull: ['$address', []] },
                as: 'addr',
                in: {
                  $cond: [
                    { $eq: ['$$addr._id', { $toObjectId: addressId }] },
                    { $mergeObjects: ['$$addr', updateData] }, // no need to add active:true here
                    { $mergeObjects: ['$$addr', { active: false }] },
                  ],
                },
              },
            },
          },
        },
      ]);

      if (pipelineUpdate.matchedCount === 0) {
        return { message: 'User or address not found', data: null, code: 404 };
      }
    } else {
      console.log({ userId, addressId, updateData });
      const buildUpdateFields = (updateData: UpdateAddressType) => {
        return Object.keys(updateData).reduce<Record<string, unknown>>((acc, key) => {
          acc[`address.$.${key}`] = updateData[key as keyof UpdateAddressType];
          return acc;
        }, {});
      };

      // Usage:
      const updateFields = buildUpdateFields(updateData);
      const result = await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId), 'address._id': new mongoose.Types.ObjectId(addressId) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        return { message: 'Address not found', data: null, code: 404 };
      }
    }

    const userAfter = await User.findById(userId).select('address');
    return {
      message: 'Address updated successfully',
      data: userAfter as unknown as UserType['address'],
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Delete a specific address
 * @param userId - The ID of the user.
 * @param addressId - The ID of the address to delete.
 * @returns A promise that resolves to a custom response indicating the result.
 */
const deleteAddress = async (userId: string, addressId: string): Promise<CustomResponseType<null>> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Remove the target address
    const result = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $pull: { address: { _id: new mongoose.Types.ObjectId(addressId) } } },
      { session }
    );

    if (result.matchedCount === 0 || result.modifiedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      return { message: 'Address not found', data: null, code: 404 };
    }

    // Step 2: Check if any active addresses remain
    const user = await User.findById(userId, { address: 1 }).session(session);

    if (user && user.address.length > 0) {
      const hasActive = user.address.some((addr) => addr.active);

      if (!hasActive) {
        // Mark the first address in the array as active
        await User.updateOne({ _id: user._id }, { $set: { 'address.0.active': true } }, { session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return { message: 'Address deleted successfully', data: null, code: 200 };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Get all user addresses
 * @param userId - The ID of the user.
 * @returns A promise that resolves to a custom response containing the user addresses.
 */
const getUserAddresses = async (userId: string): Promise<CustomResponseType<UserType['address']>> => {
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
      message: 'User addresses retrieved successfully',
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

const UserService = {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  applyCoupon,
  getUserProfile,
  updateUserProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  getUserAddresses,
};
export default UserService;
