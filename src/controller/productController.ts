import { Request, Response } from 'express';
import ProductService from '../services/productService';

// Get all products
const getAllProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const subcategory = req.query.subcategory ? String(req.query.subcategory) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const minPrice = req.query.minPrice != null ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice != null ? parseFloat(String(req.query.maxPrice)) : undefined;
    const brand = req.query.brand ? String(req.query.brand) : undefined;
    const sortBy = (req.query.sortBy as 'price' | 'name' | 'createdAt' | 'rating' | 'sales' | undefined) ?? undefined;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc' | undefined) ?? undefined;
    const availability = (req.query.availability as 'in-stock' | 'out-of-stock' | 'low-stock' | undefined) ?? undefined;
    const specKey = req.query.specKey ? String(req.query.specKey) : undefined;
    const specValue = req.query.specValue ? String(req.query.specValue) : undefined;

    const { data, message, code, meta } = await ProductService.getAllProducts({
      page,
      limit,
      category,
      subcategory,
      search,
      minPrice,
      maxPrice,
      brand,
      sortBy,
      sortOrder,
      availability,
      specKey,
      specValue,
    });
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Search products
const searchProducts = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const category = req.query.category ? String(req.query.category) : undefined;
    const minPrice = req.query.minPrice != null ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice != null ? parseFloat(String(req.query.maxPrice)) : undefined;
    const brand = req.query.brand ? String(req.query.brand) : undefined;
    const sortBy = (req.query.sortBy as 'price' | 'name' | 'createdAt' | 'rating' | 'sales' | undefined) ?? undefined;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc' | undefined) ?? undefined;
    const specKey = req.query.specKey ? String(req.query.specKey) : undefined;
    const specValue = req.query.specValue ? String(req.query.specValue) : undefined;
    const filters = {
      category,
      minPrice,
      maxPrice,
      brand,
      sortBy,
      sortOrder,
      specKey,
      specValue,
    };

    const { data, message, code, meta } = await ProductService.searchProducts(q, filters, page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Enhanced analytics and recommendation functions

// Get products of the week (now with filter support)
const getWeekProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      minPrice,
      maxPrice,
      tags,
      attributes,
      sort,
      inStock,
      packSize,
    } = req.query as {
      page?: string;
      limit?: string;
      minPrice?: string;
      maxPrice?: string;
      tags?: string | string[];
      attributes?: string | string[];
      sort?: string | string[];
      inStock?: string;
      packSize?: string;
    };

    // Parse tags
    let parsedTags: string[] | undefined;
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
    }

    // Parse attributes
    let parsedAttributes: Record<string, string[]> | undefined;
    if (attributes) {
      const attrArray = Array.isArray(attributes) ? attributes : [attributes];
      parsedAttributes = {};
      attrArray.forEach((attr) => {
        const [name, valuesStr] = attr.split(':');
        if (name && valuesStr) {
          parsedAttributes![name] = valuesStr.split('|').map((v) => v.trim());
        }
      });
    }

    // Parse sort
    type SortOption =
      | 'alphabetical'
      | 'newest'
      | 'price_asc'
      | 'price_desc'
      | 'popular'
      | 'stock'
      | 'order_frequency'
      | 'rating';
    let parsedSort: SortOption[] = ['order_frequency'];
    if (sort) {
      const sortArray = Array.isArray(sort) ? sort : sort.split(',').map((s) => s.trim());
      parsedSort = sortArray as SortOption[];
    }

    const { data, message, code, meta } = await ProductService.getWeekProducts(
      Number(page),
      Number(limit),
      parsedSort,
      {
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        tags: parsedTags,
        attributes: parsedAttributes,
        inStock: inStock === 'true',
        packSize,
      }
    );
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getWeekProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get top sold products (now with filter support)
const getTopSoldProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      minPrice,
      maxPrice,
      tags,
      attributes,
      sort,
      inStock,
      packSize,
    } = req.query as {
      page?: string;
      limit?: string;
      minPrice?: string;
      maxPrice?: string;
      tags?: string | string[];
      attributes?: string | string[];
      sort?: string | string[];
      inStock?: string;
      packSize?: string;
    };

    // Parse tags
    let parsedTags: string[] | undefined;
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
    }

    // Parse attributes
    let parsedAttributes: Record<string, string[]> | undefined;
    if (attributes) {
      const attrArray = Array.isArray(attributes) ? attributes : [attributes];
      parsedAttributes = {};
      attrArray.forEach((attr) => {
        const [name, valuesStr] = attr.split(':');
        if (name && valuesStr) {
          parsedAttributes![name] = valuesStr.split('|').map((v) => v.trim());
        }
      });
    }

    // Parse sort
    type SortOption =
      | 'alphabetical'
      | 'newest'
      | 'price_asc'
      | 'price_desc'
      | 'popular'
      | 'stock'
      | 'order_frequency'
      | 'rating';
    let parsedSort: SortOption[] = ['order_frequency'];
    if (sort) {
      const sortArray = Array.isArray(sort) ? sort : sort.split(',').map((s) => s.trim());
      parsedSort = sortArray as SortOption[];
    }

    const { data, message, code, meta } = await ProductService.getTopSoldProducts(
      Number(page),
      Number(limit),
      parsedSort,
      {
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        tags: parsedTags,
        attributes: parsedAttributes,
        inStock: inStock === 'true',
        packSize,
      }
    );
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getTopSoldProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get hot sales products
const getHotSalesProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const { data, message, code, meta } = await ProductService.getHotSalesProducts(page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getHotSalesProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get product by ID
const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { data, message, code } = await ProductService.getProductById(id);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get products recommended based off the current product ID
const getRecommendation = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const { data, message, code, meta } = await ProductService.recommendBasedOnCurrentProduct(productId, page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getProductById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get product recommendations for a user (personalized)
const getProductRecommendations = async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || '';
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const { data, message, code, meta } = await ProductService.getProductRecommendations(userId, page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getProductRecommendations:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
const getByCategorySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Parse sort parameter - can be array or single value
    // Examples:
    // ?sort=alphabetical (single)
    // ?sort=alphabetical,newest (comma-separated)
    // ?sort[]=price_asc&sort[]=alphabetical (array notation)
    let sortOptions: Array<
      'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'stock' | 'order_frequency' | 'rating'
    > = ['alphabetical', 'newest'];

    if (req.query.sort) {
      if (Array.isArray(req.query.sort)) {
        // Array notation: ?sort[]=alphabetical&sort[]=newest
        sortOptions = req.query.sort as Array<
          'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'stock' | 'order_frequency' | 'rating'
        >;
      } else if (typeof req.query.sort === 'string') {
        // Comma-separated: ?sort=alphabetical,newest or single: ?sort=alphabetical
        sortOptions = req.query.sort.split(',').map((s) => s.trim()) as Array<
          'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'stock' | 'order_frequency' | 'rating'
        >;
      }
    }

    // Parse filters
    const minPrice = req.query.minPrice != null ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice != null ? parseFloat(String(req.query.maxPrice)) : undefined;
    const subcategory = req.query.subcategory ? String(req.query.subcategory) : undefined; // slug
    const inStock = typeof req.query.inStock !== 'undefined' ? String(req.query.inStock) === 'true' : undefined;
    const packSize = req.query.packSize ? String(req.query.packSize) : undefined;
    const includeStats =
      typeof req.query.includeStats !== 'undefined' ? String(req.query.includeStats) === 'true' : undefined;

    // tags can be array or comma-separated
    let tags: string[] | undefined;
    if (typeof req.query.tags === 'string') {
      tags = req.query.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (Array.isArray(req.query.tags)) {
      tags = (req.query.tags as string[]).map((t) => t.trim()).filter(Boolean);
    }

    // attributes/specs format: ["Color:Red", "Size:M|L"]
    const parseKV = (input: string[] | string | undefined): Record<string, string[]> | undefined => {
      if (!input) return undefined;
      const arr = Array.isArray(input) ? input : input.split(',');
      const map = new Map<string, Set<string>>();
      for (const item of arr) {
        const [kRaw, vRaw] = item.split(':');
        if (!kRaw || !vRaw) continue;
        const key = kRaw.trim();
        const values = vRaw
          .split('|')
          .map((v) => v.trim())
          .filter(Boolean);
        if (!map.has(key)) map.set(key, new Set<string>());
        const set = map.get(key)!;
        values.forEach((v) => set.add(v));
      }
      const out: Record<string, string[]> = {};
      for (const [k, set] of map.entries()) out[k] = Array.from(set);
      return Object.keys(out).length ? out : undefined;
    };

    const attributeFilters = parseKV(req.query.attributes as string[] | string | undefined);
    const specFilters = parseKV(req.query.specs as string[] | string | undefined);

    const { data, message, code, meta } = await ProductService.getByCategorySlug(
      slug,
      page,
      limit,
      sortOptions,
      {
        minPrice,
        maxPrice,
        subcategory,
        tags,
        packSize,
        inStock,
        attributes: attributeFilters,
        specs: specFilters,
      },
      includeStats
    );
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getByCategorySlug:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
const getProductBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params as { slug: string };
    const { data, message, code } = await ProductService.getProductBySlug(slug);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductBySlug:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get top categories by sales volume
const getTopCategories = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const { data, message, code } = await ProductService.getTopCategories(limit);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopCategories:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get new products (now with filter support)
const getNewProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      minPrice,
      maxPrice,
      tags,
      attributes,
      sort,
      inStock,
      packSize,
    } = req.query as {
      page?: string;
      limit?: string;
      minPrice?: string;
      maxPrice?: string;
      tags?: string | string[];
      attributes?: string | string[];
      sort?: string | string[];
      inStock?: string;
      packSize?: string;
    };

    // Parse tags
    let parsedTags: string[] | undefined;
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
    }

    // Parse attributes
    let parsedAttributes: Record<string, string[]> | undefined;
    if (attributes) {
      const attrArray = Array.isArray(attributes) ? attributes : [attributes];
      parsedAttributes = {};
      attrArray.forEach((attr) => {
        const [name, valuesStr] = attr.split(':');
        if (name && valuesStr) {
          parsedAttributes![name] = valuesStr.split('|').map((v) => v.trim());
        }
      });
    }

    // Parse sort
    type SortOption =
      | 'alphabetical'
      | 'newest'
      | 'price_asc'
      | 'price_desc'
      | 'popular'
      | 'stock'
      | 'order_frequency'
      | 'rating';
    let parsedSort: SortOption[] = ['newest'];
    if (sort) {
      const sortArray = Array.isArray(sort) ? sort : sort.split(',').map((s) => s.trim());
      parsedSort = sortArray as SortOption[];
    }

    const { data, message, code, meta } = await ProductService.getNewProducts(Number(page), Number(limit), parsedSort, {
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      tags: parsedTags,
      attributes: parsedAttributes,
      inStock: inStock === 'true',
      packSize,
    });
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getNewProducts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Search autocomplete
const searchAutocomplete = async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const { data, message, code } = await ProductService.searchAutocomplete(query, limit);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in searchAutocomplete:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get products from "Deals of the Day" campaign
const getDealsOfTheDay = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const { data, message, code, meta } = await ProductService.getDealsOfTheDay(page, limit);
    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getDealsOfTheDay:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get products from a specific campaign by slug with filtering
const getProductsByCampaignSlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params as { slug: string };
    const {
      page = '1',
      limit = '20',
      minPrice,
      maxPrice,
      tags,
      attributes,
      sort,
      inStock,
      packSize,
    } = req.query as {
      page?: string;
      limit?: string;
      minPrice?: string;
      maxPrice?: string;
      tags?: string | string[];
      attributes?: string | string[];
      sort?: string | string[];
      inStock?: string;
      packSize?: string;
    };

    // Parse tags: can be comma-separated string or array
    let parsedTags: string[] | undefined;
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
    }

    // Parse attributes: ["Color:Red|Blue", "Size:Large|XL"] to Record<string, string[]>
    let parsedAttributes: Record<string, string[]> | undefined;
    if (attributes) {
      const attrArray = Array.isArray(attributes) ? attributes : [attributes];
      parsedAttributes = {};
      attrArray.forEach((attr) => {
        const [name, valuesStr] = attr.split(':');
        if (name && valuesStr) {
          parsedAttributes![name] = valuesStr.split('|').map((v) => v.trim());
        }
      });
    }

    // Parse sort: can be comma-separated string or array
    type SortOption =
      | 'alphabetical'
      | 'newest'
      | 'price_asc'
      | 'price_desc'
      | 'popular'
      | 'stock'
      | 'order_frequency'
      | 'rating';
    let parsedSort: SortOption[] = ['alphabetical', 'newest'];
    if (sort) {
      const sortArray = Array.isArray(sort) ? sort : sort.split(',').map((s) => s.trim());
      parsedSort = sortArray as SortOption[];
    }

    // Call product service with campaign slug and filters
    const { data, message, code, meta } = await ProductService.getProductsByCampaignSlug(
      slug,
      Number(page),
      Number(limit),
      parsedSort,
      {
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        tags: parsedTags,
        attributes: parsedAttributes,
        inStock: inStock === 'true',
        packSize,
      }
    );

    return res.status(code).json({ message, data, meta });
  } catch (error) {
    console.error('Error in getProductsByCampaignSlug:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get filter options for new products
const getNewProductsFilters = async (req: Request, res: Response) => {
  try {
    const { data, message, code } = await ProductService.getNewProductsFilters();
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getNewProductsFilters:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get filter options for week products
const getWeekProductsFilters = async (req: Request, res: Response) => {
  try {
    const { data, message, code } = await ProductService.getWeekProductsFilters();
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getWeekProductsFilters:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get filter options for top sold products
const getTopSoldProductsFilters = async (req: Request, res: Response) => {
  try {
    const { data, message, code } = await ProductService.getTopSoldProductsFilters();
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopSoldProductsFilters:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getAllProducts,
  searchProducts,
  getWeekProducts,
  getTopSoldProducts,
  getHotSalesProducts,
  getProductRecommendations,
  getByCategorySlug,
  getProductBySlug,
  getProductById,
  getRecommendation,
  getTopCategories,
  getNewProducts,
  searchAutocomplete,
  getDealsOfTheDay,
  getProductsByCampaignSlug,
  getNewProductsFilters,
  getWeekProductsFilters,
  getTopSoldProductsFilters,
};
