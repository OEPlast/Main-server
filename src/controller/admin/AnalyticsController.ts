import { Request, Response } from 'express';
import Admin_AnalyticsService from '@/services/admin/AnalyticsService';

const getSellerStatistics = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSellerStatistics({
      from: new Date(from as string),
      to: new Date(to as string),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSellerStatistics:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTotalSales = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTotalSales({
      from: new Date(from as string),
      to: new Date(to as string),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTotalSales:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getChartData = async (req: Request, res: Response) => {
  try {
    const { metric, from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getChartData({
      metric: metric as string,
      from: new Date(from as string),
      to: new Date(to as string),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getChartData:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderVsReturns = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderVsReturns({
      from: new Date(from as string),
      to: new Date(to as string),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderVsReturns:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getRangeCount = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getRangeCount({
      from: new Date(from as string),
      to: new Date(to as string),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getRangeCount:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getPaginatedStatisticsDays = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getPaginatedStatisticsDays({
      from: new Date(from as string),
      to: new Date(to as string),
      page: parseInt(page as string, 10),
      ...(limit && { limit: ~~limit }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getPaginatedStatisticsDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getPaginatedStatisticsWeeks = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getPaginatedStatisticsWeeks({
      from: new Date(from as string),
      to: new Date(to as string),
      page: parseInt(page as string, 10),
      ...(limit && { limit: ~~limit }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getPaginatedStatisticsWeeks:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getPaginatedStatisticsMonths = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getPaginatedStatisticsMonths({
      from: new Date(from as string),
      to: new Date(to as string),
      page: parseInt(page as string, 10),
      ...(limit && { limit: ~~limit }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getPaginatedStatisticsMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getPaginatedStatisticsYears = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getPaginatedStatisticsYears({
      from: new Date(from as string),
      to: new Date(to as string),
      page: parseInt(page as string, 10),
      ...(limit && { limit: ~~limit }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getPaginatedStatisticsYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const Admin_AnalyticsController = {
  getSellerStatistics,
  getTotalSales,
  getChartData,
  getOrderVsReturns,
  getRangeCount,
  getPaginatedStatisticsDays,
  getPaginatedStatisticsWeeks,
  getPaginatedStatisticsMonths,
  getPaginatedStatisticsYears,
};

export default Admin_AnalyticsController;
