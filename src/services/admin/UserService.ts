import mongoose, { PipelineStage } from 'mongoose';
import { escapeRegex } from '@/helpers/regex';
import { anonymiseUser } from '@/services/users/accountDeletion';
import User, { UserType } from '@/models/User';
import { CustomResponsePromise, CustomResponseTypeWithMeta } from '@/types';
import Order, { OrderType } from '@/models/Order';
import Review, { ReviewType } from '@/models/Review';
import Wishlist from '@/models/wishlist';

/** The staff member performing an admin action on a user. */
export type StaffActor = { id: string; role?: UserType['role'] | string };

/**
 * Returns a 403 response when `actor` may not change `target`, or null when the action is allowed.
 *
 * Owners bypass every permission check, so the owner role is the keys to the store. A staff member
 * with `users:update` could previously make themselves owner, and could suspend or delete the real
 * owner (which now actually locks them out, since suspended tokens are refused).
 */
const staffActionDenied = (
  actor: StaffActor,
  target: { _id: { toString(): string }; role?: string | null },
  action: string
): { message: string; data: null; code: number } | null => {
  if (target._id.toString() === actor.id) {
    return { message: `You cannot ${action} your own account`, data: null, code: 403 };
  }
  if (target.role === 'owner' && actor.role !== 'owner') {
    return { message: `Only an owner can ${action} an owner`, data: null, code: 403 };
  }
  return null;
};

/**
 * Updates the role of a user.
 * @param userId - The ID of the user to update.
 * @param role - The new role to assign to the user.
 * @param actor - The staff member making the change.
 * @returns A promise that resolves to a custom response indicating success or failure.
 */
const updateUserRole = async ({
  userId,
  role,
  actor,
}: {
  userId: string;
  role: UserType['role'];
  actor: StaffActor;
}): CustomResponsePromise<null> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { message: 'User not found', data: null, code: 404 };
    }
    const denied = staffActionDenied(actor, user, 'change the role of');
    if (denied) return denied;
    if (role === 'owner' && actor.role !== 'owner') {
      return { message: 'Only an owner can grant the owner role', data: null, code: 403 };
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
 * @param actor - The staff member making the change.
 * @returns A promise that resolves to a custom response indicating success or failure.
 */
const suspendedStatus = async ({
  userId,
  suspend,
  actor,
}: {
  userId: string;
  suspend: boolean;
  actor: StaffActor;
}): CustomResponsePromise<null> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return { message: 'User not found', data: null, code: 404 };
    }
    const denied = staffActionDenied(actor, user, suspend ? 'suspend' : 'unsuspend');
    if (denied) {
      await session.abortTransaction();
      return denied;
    }
    user.suspended = suspend;
    if (suspend) {
      // Revoke every session now, and keep them revoked if the account is later unsuspended.
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }
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
 * @param actor - The staff member making the change.
 * @returns A promise that resolves to a custom response indicating success or failure.
 */
const deleteUser = async (userId: string, actor: StaffActor): CustomResponsePromise<null> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { message: 'User not found', data: null, code: 404 };
    }
    const denied = staffActionDenied(actor, user, 'delete');
    if (denied) {
      return denied;
    }
    // Anonymise instead of removing the document: a hard delete left orders, payments, returns
    // and reviews pointing at a user that no longer existed, and kept their addresses on file.
    const result = await anonymiseUser(userId, { by: 'staff' });
    if (result.code !== 200) return { message: result.message, data: null, code: result.code };
    return { message: 'User deleted: personal data removed, order records kept', data: null, code: 200 };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { message: 'Internal server error', data: null, code: 500 };
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
}): CustomResponseTypeWithMeta<
  UserType[],
  { total: number; page: number; limit: number; pages: number }
> => {
  try {
    const match: Record<string, unknown> = {};

    if (search) {
      const safeSearch = escapeRegex(search);
      match.$or = [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
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
                joinedAt: '$createdAt', // Rename `createdAt` to `joinedAt`
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
      }
    );

    const result = await User.aggregate(pipeline);
    const total = result[0]?.metadata[0]?.total || 0;
    const users = result[0]?.users || [];
    const pages = Math.ceil(total / limit);

    return {
      message: 'Users fetched successfully',
      data: users,
      code: 200,
      meta: { total, page, limit, pages },
    };
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
      const safeSearch = escapeRegex(search);
      match.$or = [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
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
      {
        $lookup: {
          from: 'roles',
          localField: 'roles',
          foreignField: '_id',
          as: 'populatedRoles',
        },
      },
      {
        $addFields: {
          permissionCount: {
            $sum: {
              $map: {
                input: '$populatedRoles',
                as: 'role',
                in: { $size: { $ifNull: ['$$role.permissions', []] } },
              },
            },
          },
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
                permissionCount: 1,
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
/**
 * Search users by email or name (lightweight for autocomplete/selectors)
 * @param query - Search query string
 * @returns Promise with array of users (minimal data)
 */
const searchUsers = async (
  query: string
): CustomResponsePromise<Array<{ _id: string; name: string; email: string; reviewCount?: number }>> => {
  try {
    if (!query || query.trim().length < 2) {
      return {
        message: 'Search query must be at least 2 characters',
        data: [],
        code: 400,
      };
    }

    const searchRegex = new RegExp(escapeRegex(query), 'i');

    const users = await User.find({
      $or: [{ email: searchRegex }, { firstName: searchRegex }, { lastName: searchRegex }],
      // role: 'user', // Only search regular users, not staff
    })
      .select('_id firstName lastName email name')
      .limit(20);
    // .lean()
    // .exec();

    // Get review counts for these users
    const userIds = users.map((u) => u._id);
    const reviewCounts = await Review.aggregate([
      { $match: { reviewBy: { $in: userIds } } },
      { $group: { _id: '$reviewBy', count: { $sum: 1 } } },
    ]);

    const reviewCountMap = new Map(reviewCounts.map((r) => [r._id.toString(), r.count]));

    const userList = users.map((user) => ({
      _id: user._id.toString(),
      name: user.name || 'Unknown',
      email: user.email,
      reviewCount: reviewCountMap.get(user._id.toString()) || 0,
    }));

    return {
      message: 'Users found successfully',
      data: userList,
      code: 200,
    };
  } catch (error) {
    console.error('Error searching users:', error);
    return { message: 'Internal server error', data: null, code: 500 };
  }
};

/**
 * List courier-eligible staff: owners or staff with DELIVERY permission.
 * Returns minimal fields for dropdowns.
 */
const listCouriers = async ({
  search,
}: {
  search?: string;
}): CustomResponsePromise<Array<{ _id: string; name: string; email: string }>> => {
  try {
    const query: Record<string, unknown> = {
      role: { $in: ['owner', 'employee'] },
    };
    if (search) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ name: regex }, { email: regex }, { firstName: regex }, { lastName: regex }];
    }

    const users = await User.find(query)
      .select('_id name email role roles')
      .populate({ path: 'roles', select: 'permissions isActive name' })
      .sort({ createdAt: -1 })
      .lean();

    const couriers = (users as Array<any>).filter((u) => {
      if (u.role === 'owner') return true;
      const roles: Array<{ isActive: boolean; permissions: Array<{ resource: string; actions: string[] }> }> =
        (u.roles as any[]) || [];
      return roles.some(
        (r) => r?.isActive && r.permissions?.some((p) => p.resource === 'delivery' || p.resource === 'all')
      );
    });

    const minimal = couriers.map((u) => ({ _id: String(u._id), name: u.name || 'Unknown', email: u.email }));
    return { message: 'Couriers fetched successfully', data: minimal, code: 200 };
  } catch (error) {
    console.error('Error listing couriers:', error);
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
  searchUsers,
  listCouriers,
};

export default Admin_UserService;
