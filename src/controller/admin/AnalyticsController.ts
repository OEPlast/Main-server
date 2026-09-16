import { Request, Response } from 'express';
import Admin_AnalyticsService from '@/services/admin/AnalyticsService';
import { parseAnalyticsDate } from '@/helpers/dateParser';

const getTopProductsRevenue = async (req: Request, res: Response) => {
  try {
    const { from, to, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTopProductsRevenue({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      limit: limit ? parseInt(limit as string, 10) : 10,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopProductsRevenue:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCategoriesPerformance = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCategoriesPerformance({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCategoriesPerformance:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrdersTable = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit, status, sortBy, sortOrder } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrdersTable({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      status: status as string,
      sortBy: (sortBy as string) || 'createdAt',
      sortOrder: (sortOrder as string) || 'desc',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrdersTable:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTransactionsTable = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit, status, method, sortBy, sortOrder } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTransactionsTable({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      status: status as string,
      method: method as string,
      sortBy: (sortBy as string) || 'createdAt',
      sortOrder: (sortOrder as string) || 'desc',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTransactionsTable:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProductPerformance = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit, sortBy, sortOrder, search } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getProductPerformance({
      from: from ? parseAnalyticsDate(from as string, 'from') : undefined,
      to: to ? parseAnalyticsDate(to as string, 'to') : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      search: search as string,
      sortBy: (sortBy as string) || 'revenue',
      sortOrder: (sortOrder as string) || 'desc',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductPerformance:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewsTable = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit, rating, status, sortBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewsTable({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      rating: rating ? parseInt(rating as string, 10) : undefined,
      status: status as string,
      sortBy: (sortBy as string) || 'createdAt',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewsTable:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const Admin_AnalyticsController = {
  getTopProductsRevenue,
  getCategoriesPerformance,
  getOrdersTable,
  getTransactionsTable,
  getProductPerformance,
  getReviewsTable,
};

export default Admin_AnalyticsController;
