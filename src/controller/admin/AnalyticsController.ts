import { Request, Response } from 'express';
import Admin_AnalyticsService from '@/services/admin/AnalyticsService';
import { parseAnalyticsDate } from '@/helpers/dateParser';

const getSellerStatistics = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSellerStatistics({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
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
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
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
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
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
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
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
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
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
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
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
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
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
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
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
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      page: parseInt(page as string, 10),
      ...(limit && { limit: ~~limit }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getPaginatedStatisticsYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getWishlistFrequencyByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getWishlistFrequencyByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getWishlistFrequencyByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getWishlistFrequencyByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getWishlistFrequencyByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getWishlistFrequencyByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getWishlistFrequencyByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getWishlistFrequencyByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getWishlistFrequencyByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrdersByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrdersByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrdersByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrdersByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrdersByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrdersByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrdersByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrdersByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrdersByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderCancelledByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderCancelledByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderCancelledByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderCancelledByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderCancelledByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderCancelledByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderCancelledByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderCancelledByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderCancelledByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getShipmentsDeliveredByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getShipmentsDeliveredByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getShipmentsDeliveredByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getShipmentsDeliveredByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getShipmentsDeliveredByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getShipmentsDeliveredByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getShipmentsDeliveredByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getShipmentsDeliveredByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getShipmentsDeliveredByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderReturnedByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderReturnedByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderReturnedByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderReturnedByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderReturnedByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderReturnedByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderReturnedByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderReturnedByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderReturnedByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderFailedByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderFailedByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderFailedByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderFailedByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderFailedByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderFailedByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderFailedByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderFailedByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderFailedByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getShipmentsInWarehouseByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getShipmentsInWarehouseByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getShipmentsInWarehouseByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getShipmentsInWarehouseByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getShipmentsInWarehouseByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getShipmentsInWarehouseByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getShipmentsInWarehouseByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getShipmentsInWarehouseByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getShipmentsInWarehouseByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTransactionsByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTransactionsByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTransactionsByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTransactionsByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTransactionsByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTransactionsByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTransactionsByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTransactionsByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTransactionsByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTotalTransactionsByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTotalTransactionsByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTotalTransactionsByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTotalTransactionsByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTotalTransactionsByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTotalTransactionsByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTotalTransactionsByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTotalTransactionsByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTotalTransactionsByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getUserJoiningRateByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getUserJoiningRateByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getUserJoiningRateByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getUserJoiningRateByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getUserJoiningRateByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getUserJoiningRateByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getUserJoiningRateByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getUserJoiningRateByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getUserJoiningRateByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCouponRedemptionByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCouponRedemptionByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCouponRedemptionByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCouponRedemptionByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCouponRedemptionByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCouponRedemptionByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCouponRedemptionByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCouponRedemptionByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCouponRedemptionByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewsByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewsByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewsByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewsByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewsByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewsByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewsByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewsByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewsByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewRateByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewRateByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewRateByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewRateByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewRateByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewRateByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewRateByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewRateByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewRateByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewMoodByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewMoodByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewMoodByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewMoodByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewMoodByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewMoodByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewMoodByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewMoodByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewMoodByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getRevenueByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getRevenueByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getRevenueByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getRevenueByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getRevenueByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getRevenueByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getRevenueByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getRevenueByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getRevenueByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProductsAddedByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getProductsAddedByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductsAddedByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProductsAddedByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getProductsAddedByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductsAddedByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProductsAddedByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getProductsAddedByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductsAddedByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCurrentCartsByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCurrentCartsByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCurrentCartsByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCurrentCartsByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCurrentCartsByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCurrentCartsByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCurrentCartsByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCurrentCartsByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCurrentCartsByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getSalesByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSalesByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSalesByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getSalesByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSalesByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSalesByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getSalesByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSalesByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSalesByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getSalesDiscountTotalByDays = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSalesDiscountTotalByDays({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSalesDiscountTotalByDays:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getSalesDiscountTotalByMonths = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSalesDiscountTotalByMonths({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSalesDiscountTotalByMonths:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getSalesDiscountTotalByYears = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSalesDiscountTotalByYears({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSalesDiscountTotalByYears:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// ============================================
// NEW ANALYTICS CONTROLLER METHODS
// ============================================

const getSalesOverview = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSalesOverview({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSalesOverview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrdersOverview = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrdersOverview({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrdersOverview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTransactionsOverview = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTransactionsOverview({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTransactionsOverview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getUsersOverview = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getUsersOverview({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getUsersOverview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProductsOverview = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getProductsOverview({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProductsOverview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewsOverview = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewsOverview({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewsOverview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCouponsOverview = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCouponsOverview({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCouponsOverview:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getRevenueExpenseChart = async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getRevenueExpenseChart({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      groupBy: (groupBy as string) || 'months',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getRevenueExpenseChart:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProfitLossChart = async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getProfitLossChart({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      groupBy: (groupBy as string) || 'months',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getProfitLossChart:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrdersTrend = async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrdersTrend({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      groupBy: (groupBy as string) || 'months',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrdersTrend:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTransactionsTrend = async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTransactionsTrend({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      groupBy: (groupBy as string) || 'months',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTransactionsTrend:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCustomerAcquisition = async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCustomerAcquisition({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      groupBy: (groupBy as string) || 'months',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCustomerAcquisition:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getOrderStatusDistribution = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getOrderStatusDistribution({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getOrderStatusDistribution:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTransactionStatusDistribution = async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTransactionStatusDistribution({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      groupBy: groupBy as string,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTransactionStatusDistribution:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getRatingDistribution = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getRatingDistribution({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getRatingDistribution:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getReviewSentiment = async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getReviewSentiment({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      groupBy: (groupBy as string) || 'months',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getReviewSentiment:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCouponRedemptionTrend = async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCouponRedemptionTrend({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      groupBy: (groupBy as string) || 'months',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCouponRedemptionTrend:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getPaymentMethods({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getPaymentMethods:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

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

const getUserDemographics = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getUserDemographics({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getUserDemographics:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getCouponTypeDistribution = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getCouponTypeDistribution({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getCouponTypeDistribution:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getSalesByCategory = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit, sortBy, sortOrder } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getSalesByCategory({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      sortBy: (sortBy as string) || 'totalRevenue',
      sortOrder: (sortOrder as string) || 'desc',
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getSalesByCategory:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTopSellingProducts = async (req: Request, res: Response) => {
  try {
    const { from, to, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTopSellingProducts({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      limit: limit ? parseInt(limit as string, 10) : 10,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopSellingProducts:', error);
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

const getTopCustomers = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTopCustomers({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopCustomers:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProductPerformance = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit, sortBy, sortOrder } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getProductPerformance({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
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

const getTopCoupons = async (req: Request, res: Response) => {
  try {
    const { from, to, page, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getTopCoupons({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getTopCoupons:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getMostWishlistedProducts = async (req: Request, res: Response) => {
  try {
    const { from, to, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getMostWishlistedProducts({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      limit: limit ? parseInt(limit as string, 10) : 10,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getMostWishlistedProducts:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getMostReviewedProducts = async (req: Request, res: Response) => {
  try {
    const { from, to, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getMostReviewedProducts({
      from: parseAnalyticsDate(from as string, 'from'),
      to: parseAnalyticsDate(to as string, 'to'),
      limit: limit ? parseInt(limit as string, 10) : 10,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getMostReviewedProducts:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;
    const { data, code, message } = await Admin_AnalyticsService.getLowStockProducts({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getLowStockProducts:', error);
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
  getWishlistFrequencyByDays,
  getWishlistFrequencyByMonths,
  getWishlistFrequencyByYears,
  getOrdersByDays,
  getOrdersByMonths,
  getOrdersByYears,
  getOrderCancelledByDays,
  getOrderCancelledByMonths,
  getOrderCancelledByYears,
  getShipmentsDeliveredByDays,
  getShipmentsDeliveredByMonths,
  getShipmentsDeliveredByYears,
  getOrderReturnedByDays,
  getOrderReturnedByMonths,
  getOrderReturnedByYears,
  getOrderFailedByDays,
  getOrderFailedByMonths,
  getOrderFailedByYears,
  getShipmentsInWarehouseByDays,
  getShipmentsInWarehouseByMonths,
  getShipmentsInWarehouseByYears,
  getTransactionsByDays,
  getTransactionsByMonths,
  getTransactionsByYears,
  getTotalTransactionsByDays,
  getTotalTransactionsByMonths,
  getTotalTransactionsByYears,
  getUserJoiningRateByDays,
  getUserJoiningRateByMonths,
  getUserJoiningRateByYears,
  getCouponRedemptionByDays,
  getCouponRedemptionByMonths,
  getCouponRedemptionByYears,
  getReviewsByDays,
  getReviewsByMonths,
  getReviewsByYears,
  getReviewRateByDays,
  getReviewRateByMonths,
  getReviewRateByYears,
  getReviewMoodByDays,
  getReviewMoodByMonths,
  getReviewMoodByYears,
  getRevenueByDays,
  getRevenueByMonths,
  getRevenueByYears,
  getProductsAddedByDays,
  getProductsAddedByMonths,
  getProductsAddedByYears,
  getCurrentCartsByDays,
  getCurrentCartsByMonths,
  getCurrentCartsByYears,
  getSalesByDays,
  getSalesByMonths,
  getSalesByYears,
  getSalesDiscountTotalByDays,
  getSalesDiscountTotalByMonths,
  getSalesDiscountTotalByYears,
  // New analytics endpoints
  getSalesOverview,
  getOrdersOverview,
  getTransactionsOverview,
  getUsersOverview,
  getProductsOverview,
  getReviewsOverview,
  getCouponsOverview,
  getRevenueExpenseChart,
  getProfitLossChart,
  getOrdersTrend,
  getTransactionsTrend,
  getCustomerAcquisition,
  getOrderStatusDistribution,
  getTransactionStatusDistribution,
  getRatingDistribution,
  getReviewSentiment,
  getCouponRedemptionTrend,
  getPaymentMethods,
  getTopProductsRevenue,
  getCategoriesPerformance,
  getUserDemographics,
  getCouponTypeDistribution,
  getSalesByCategory,
  getTopSellingProducts,
  getOrdersTable,
  getTransactionsTable,
  getTopCustomers,
  getProductPerformance,
  getReviewsTable,
  getTopCoupons,
  getMostWishlistedProducts,
  getMostReviewedProducts,
  getLowStockProducts,
};

export default Admin_AnalyticsController;
