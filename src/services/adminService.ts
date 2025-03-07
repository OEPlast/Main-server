import User, { UserType } from '../models/User';
import { CustomResponseType } from '../types';

/**
 * Retrieves all users.
 * @returns A promise that resolves to a custom response containing all users.
 */
export const getAllUsers = async (): Promise<CustomResponseType<UserType[]>> => {
  try {
    const users = await User.find();
    return {
      message: 'Users retrieved successfully',
      data: users,
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
 * Updates user role.
 * @param userId - The ID of the user to update.
 * @param newRole - The new role to set.
 * @returns A promise that resolves to a custom response containing the updated user.
 */
export const updateUserRole = async (userId: string, newRole: string): Promise<CustomResponseType<UserType>> => {
  try {
    const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true });
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'User role updated successfully',
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
export const deleteUser = async (userId: string): Promise<CustomResponseType<null>> => {
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
