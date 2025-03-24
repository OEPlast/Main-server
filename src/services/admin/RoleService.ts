import User, { UserType } from '../../models/User';
import { CustomResponseType } from '../../types';

// Update user role
const updateUserRole = async ({
  userId,
  role,
}: {
  userId: string;
  role: UserType['role'];
}): Promise<CustomResponseType<null>> => {
  try {
    const updatedUser = await User.findByIdAndUpdate(userId, { role });
    if (!updatedUser) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'User role updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating user role:', error);
    return {
      message: 'Failed to update user role',
      data: null,
      code: 500,
    };
  }
};

const RoleService = { updateUserRole };
export default RoleService;
