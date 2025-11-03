import { PipelineStage } from 'mongoose';

export const sortByPopularity = (): PipelineStage => ({
  $sort: { popularityScore: -1, averageRating: -1, orderCount: -1, createdAt: -1 },
});

export const sortByPrice = (ascending: boolean = true): PipelineStage => ({
  $sort: { price: ascending ? 1 : -1, name: 1 },
});

export const sortByNewest = (): PipelineStage => ({
  $sort: { createdAt: -1, _id: -1 },
});

export const paginationFacet = (page: number, limit: number): PipelineStage => ({
  $facet: {
    metadata: [
      { $count: 'total' },
      {
        $addFields: {
          page,
          limit,
          pages: { $ceil: { $divide: ['$total', limit] } },
        },
      },
    ],
    data: [{ $skip: Math.max(0, (page - 1) * limit) }, { $limit: limit }],
  },
});

export const formatPaginationResponse = (): PipelineStage => ({
  $project: {
    data: 1,
    pagination: {
      $let: {
        vars: { m: { $arrayElemAt: ['$metadata', 0] } },
        in: {
          total: { $ifNull: ['$$m.total', 0] },
          page: { $ifNull: ['$$m.page', 1] },
          limit: { $ifNull: ['$$m.limit', 0] },
          pages: { $ifNull: ['$$m.pages', 0] },
        },
      },
    },
  },
});
