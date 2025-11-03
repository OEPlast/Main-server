import { PipelineStage } from 'mongoose';

/** Lookup reviews and compute rating stats into `reviewStats` */
export const lookupReviewStats = (): PipelineStage => ({
  $lookup: {
    from: 'reviews',
    let: { productId: '$_id' },
    pipeline: [
      { $match: { $expr: { $and: [{ $eq: ['$product', '$$productId'] }, { $eq: ['$isApproved', true] }] } } },
      { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ],
    as: 'reviewStats',
  },
});

/** Lookup orders and compute order stats into `orderStats` */
export const lookupOrderStats = (): PipelineStage => ({
  $lookup: {
    from: 'orders',
    let: { productId: '$_id' },
    pipeline: [
      { $unwind: '$products' },
      {
        $match: {
          $expr: {
            $and: [{ $eq: ['$products.product', '$$productId'] }, { $in: ['$status', ['Processing', 'Completed']] }],
          },
        },
      },
      {
        $group: {
          _id: '$products.product',
          orderCount: { $sum: 1 },
          soldQuantity: { $sum: '$products.quantity' },
        },
      },
    ],
    as: 'orderStats',
  },
});

/** Add computed fields: averageRating, reviewCount, orderCount, soldQuantity, popularityScore */
export const addProductComputedFields = (): PipelineStage => ({
  $addFields: {
    averageRating: { $ifNull: [{ $arrayElemAt: ['$reviewStats.avg', 0] }, 0] },
    reviewCount: { $ifNull: [{ $arrayElemAt: ['$reviewStats.count', 0] }, 0] },
    orderCount: { $ifNull: [{ $arrayElemAt: ['$orderStats.orderCount', 0] }, 0] },
    soldQuantity: { $ifNull: [{ $arrayElemAt: ['$orderStats.soldQuantity', 0] }, 0] },
    popularityScore: {
      $add: [
        { $multiply: [{ $ifNull: [{ $arrayElemAt: ['$reviewStats.avg', 0] }, 0] }, 10] },
        { $multiply: [{ $ifNull: [{ $arrayElemAt: ['$orderStats.orderCount', 0] }, 0] }, 2] },
        { $ifNull: [{ $arrayElemAt: ['$reviewStats.count', 0] }, 0] },
      ],
    },
  },
});

/** Enrich product with category info */
export const lookupCategoryInfo = (): PipelineStage => ({
  $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryInfo' },
});

/** Project standard list item fields plus computed stats */
export const projectProductFields = (): PipelineStage => ({
  $project: {
    _id: 1,
    sku: 1,
    name: 1,
    slug: 1,
    price: 1,
    stock: 1,
    description_images: 1,
    attributes: 1,
    category: {
      _id: { $arrayElemAt: ['$categoryInfo._id', 0] },
      name: { $arrayElemAt: ['$categoryInfo.name', 0] },
      slug: { $arrayElemAt: ['$categoryInfo.slug', 0] },
    },
    averageRating: 1,
    reviewCount: 1,
    orderCount: 1,
    soldQuantity: 1,
    popularityScore: 1,
    createdAt: 1,
    updatedAt: 1,
  },
});
