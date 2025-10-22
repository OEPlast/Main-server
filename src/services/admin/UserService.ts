import mongoose, { PipelineStage } from 'mongoose';
import User, { UserType } from '@/models/User';
import { CustomResponsePromise } from '@/types';
import Order, { OrderType } from '@/models/Order';
import Review, { ReviewType } from '@/models/Review';
import Wishlist from '@/models/wishlist';

/**
 * Updates the role of a user.
 * @param userId - The ID of the user to update.
 * @param role - The new role to assign to the user.
 * @returns A promise that resolves to a custom response indicating success or failure.
 */
const updateUserRole = async ({
  userId,
  role,
}: {
  userId: string;
  role: UserType['role'];
}): CustomResponsePromise<null> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { message: 'User not found', data: null, code: 404 };
    }
    user.role = role;
    await user.save();
    return { message: 'User role updated successfully', data: null, code: 200 };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Updates the suspension status of a user.
 * @param userId - The ID of the user to update.
 * @param suspend - A boolean indicating whether to suspend or unsuspend the user.
 * @returns A promise that resolves to a custom response indicating success or failure.
 */
const suspendedStatus = async ({
  userId,
  suspend,
}: {
  userId: string;
  suspend: boolean;
}): CustomResponsePromise<null> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return { message: 'User not found', data: null, code: 404 };
    }
    user.suspended = suspend;
    await user.save({ session });
    await session.commitTransaction();
    return { message: `User ${suspend ? 'suspended' : 'unsuspended'} successfully`, data: null, code: 200 };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating suspension status:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  } finally {
    session.endSession();
  }
};

/**
 * Deletes a user by their ID.
 * @param userId - The ID of the user to delete.
 * @returns A promise that resolves to a custom response indicating success or failure.
 */
const deleteUser = async (userId: string): CustomResponsePromise<null> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return { message: 'User not found', data: null, code: 404 };
    }
    await user.deleteOne({ session });
    await session.commitTransaction();
    return { message: 'User deleted successfully', data: null, code: 200 };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting user:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  } finally {
    session.endSession();
  }
};

/**
 * Fetches all users with pagination and optional search functionality.
 * @param page - The page number for pagination.
 * @param limit - The number of users per page.
 * @param search - A search string to filter users by name or email.
 * @returns A promise that resolves to a custom response containing the list of users.
 */
const getAllUsersWithPaginationAndSearch = async ({
  page = 1,
  limit = 50,
  search,
  sort = -1,
  role,
}: {
  page: number;
  limit?: number;
  search?: string;
  sort?: 1 | -1;
  role?: UserType['role'];
}): CustomResponsePromise<UserType[]> => {
  try {
    const match: Record<string, unknown> = {};

    if (search) {
      match.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      match.role = role;
    }

    const pipeline: PipelineStage[] = [];
    if (Object.keys(match).length) {
      pipeline.push({ $match: match });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'orders',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] }, // match user id
                    { $ne: ['$status', 'Cancelled'] }, // exclude cancelled orders
                  ],
                },
              },
            },
          ],
          as: 'orders',
        },
      },
      {
        $addFields: {
          orderCount: { $size: '$orders' },
          totalSpent: { $sum: '$orders.total' },
        },
      },
      { $sort: { firstName: sort, email: sort } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          joinedAt: '$createdAt', // Rename `createdAt` to `joinedAt`
          orderCount: 1,
          totalSpent: 1,
          suspended: 1,
          image: 1,
          role: 1,
        },
      }
    );

    const users = await User.aggregate(pipeline);
    return { message: 'Users fetched successfully', data: users, code: 200 };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches a user and their related information such as orders, wishlist, and reviews.
 * @param userId - The ID of the user to fetch.
 * @param orderPage - The page number for paginated orders.
 * @param orderLimit - The number of orders per page.
 * @param reviewPage - The page number for paginated reviews.
 * @param reviewLimit - The number of reviews per page.
 * @returns A promise that resolves to a custom response containing the user and their related data.
 */
const getUserAndAllTheirBasicInfo = async ({
  userId,
  orderLimit = 10,
  orderPage = 1,
  reviewLimit = 10,
  reviewPage = 1,
}: {
  userId: string;
  orderPage: number;
  orderLimit?: number;
  reviewPage: number;
  reviewLimit?: number;
}): CustomResponsePromise<{
  user: UserType;
  orders: OrderType[];
  wishlistCount: number;
  totalOrders: number;
  totalSpent: number;
  totalReturns: number;
  reviews: ReviewType[];
  totalReviewCount: number;
  averageReviewRating: number;
}> => {
  try {
    const user = await User.findById(userId).select({
      firstName: true,
      lastName: true,
      suspended: true,
      role: true,
      emailVerified: true,
      country: true,
      dob: true,
      email: true,
      createdAt: true,
    });
    if (!user) {
      return { message: 'User not found', data: null, code: 404 };
    }

    const [ordersPage, ordersTotalsAgg, wishlistCount, reviewsAgg] = await Promise.all([
      Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip((orderPage - 1) * orderLimit)
        .limit(orderLimit),
      Order.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$total' },
            totalReturns: { $sum: { $cond: [{ $eq: ['$status', 'Returned'] }, 1, 0] } },
          },
        },
      ]),
      Wishlist.countDocuments({ user: userId }),
      Review.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        {
          $facet: {
            paginatedReviews: [{ $skip: (reviewPage - 1) * reviewLimit }, { $limit: reviewLimit }],
            totals: [
              {
                $group: {
                  _id: null,
                  totalReviewCount: { $sum: 1 },
                  averageReviewRating: { $avg: '$rating' },
                },
              },
            ],
          },
        },
      ]),
    ]);

    const orderTotals = ordersTotalsAgg[0] || { totalOrders: 0, totalSpent: 0, totalReturns: 0 };
    const reviews = reviewsAgg[0]?.paginatedReviews || [];
    const reviewTotals = reviewsAgg[0]?.totals[0] || { totalReviewCount: 0, averageReviewRating: 0 };

    return {
      message: 'User data fetched successfully',
      data: {
        user,
        orders: ordersPage as unknown as OrderType[],
        wishlistCount,
        totalOrders: orderTotals.totalOrders || 0,
        totalSpent: orderTotals.totalSpent || 0,
        totalReturns: orderTotals.totalReturns || 0,
        reviews: reviews as unknown as ReviewType[],
        totalReviewCount: reviewTotals.totalReviewCount || 0,
        averageReviewRating: reviewTotals.averageReviewRating || 0,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching user info:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches users by their role with pagination and total count.
 * @param role - The role to filter users by.
 * @param page - The page number for pagination.
 * @returns A promise that resolves to a custom response containing the list of users and total count.
 */
const getUsersByRole = async ({
  role,
  page = 1,
}: {
  role: string;
  page?: number;
}): CustomResponsePromise<{ users: UserType[]; total: number }> => {
  const limit = 50; // Fixed limit per page
  try {
    const [users, total] = await Promise.all([
      User.find({ role })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments({ role }),
    ]);
    return { message: 'Users fetched successfully', data: { users, total }, code: 200 };
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * Fetches all staff members (employees and owners) with pagination and search.
 * @param page - The page number for pagination.
 * @param limit - The number of staff per page.
 * @param search - Optional search string to filter by name or email.
 * @param role - Optional role filter (employee or owner).
 * @param sort - Sort direction (1 for asc, -1 for desc).
 * @returns A promise that resolves to a custom response containing staff list and metadata.
 */
const getStaff = async ({
  page = 1,
  limit = 50,
  search,
  role,
  sort = -1,
}: {
  page: number;
  limit?: number;
  search?: string;
  role?: 'employee' | 'owner';
  sort?: 1 | -1;
}): CustomResponsePromise<{
  users: UserType[];
  total: number;
  totalPages: number;
  currentPage: number;
}> => {
  try {
    const match: Record<string, unknown> = {
      role: role ? role : { $in: ['employee', 'owner'] },
    };

    if (search) {
      match.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'orders',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$user', '$$userId'] }, { $ne: ['$status', 'Cancelled'] }],
                },
              },
            },
          ],
          as: 'orders',
        },
      },
      {
        $addFields: {
          orderCount: { $size: '$orders' },
          totalSpent: { $sum: '$orders.total' },
        },
      },
      { $sort: { firstName: sort, email: sort } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          users: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                joinedAt: '$createdAt',
                orderCount: 1,
                totalSpent: 1,
                suspended: 1,
                image: 1,
                role: 1,
                emailVerified: 1,
              },
            },
          ],
        },
      },
    ];

    const result = await User.aggregate(pipeline);
    const total = result[0]?.metadata[0]?.total || 0;
    const users = result[0]?.users || [];
    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Staff members fetched successfully',
      data: {
        users,
        total,
        totalPages,
        currentPage: page,
      },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching staff:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

const Admin_UserService = {
  updateUserRole,
  suspendedStatus,
  deleteUser,
  getAllUsersWithPaginationAndSearch,
  getUserAndAllTheirBasicInfo,
  getUsersByRole,
  getStaff,
};

export default Admin_UserService;
