# Product Recommendation Service with Review Ratings

```ts
import Product from '../models/Product';

/**
 * Recommends products based on the current product by prioritizing category matches over title matches.
 * @param productId - The ID of the current product.
 */
export const recommendBasedOnCurrentProduct = async (productId: string) => {
  const currentProduct = await Product.findById(productId);
  if (!currentProduct) {
    return { message: 'Product not found', data: [], code: 404 };
  }

  const recommendations = await Product.find({
    _id: { $ne: productId }, // Exclude the current product
    $or: [
      { category: currentProduct.category }, // Match category
      { name: { $regex: currentProduct.name.split(' ').join('|'), $options: 'i' } }, // Match words in title (case-insensitive)
    ],
  })
    .sort({
      category: -1, // Prioritize category matches
      rating: -1, // Then sort by rating
    })
    .limit(20);

  return {
    message: 'Recommendations retrieved successfully',
    data: recommendations,
    code: 200,
  };
};
```

## Dynamic Rating Calculation

If you want to calculate the average rating dynamically from the `Review` model:

```ts
import Review from '../models/Review';

/**
 * Calculates the average rating for a product using Mongoose aggregate.
 * @param productId - The ID of the product.
 */
const calculateAverageRating = async (productId: string): Promise<number> => {
  const result = await Review.aggregate([
    { $match: { product: productId } }, // Match reviews for the given product
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' }, // Calculate the average rating
      },
    },
  ]);

  return result.length ? result[0].averageRating : 0;
};
```
