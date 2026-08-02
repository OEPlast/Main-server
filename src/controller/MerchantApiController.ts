import { Request, Response } from 'express';
import MerchantApiService from '../services/MerchantApiService';
import Product from '../models/Product';

/**
 * MerchantApiController
 * Operational endpoints to push products to Google Merchant Center via the
 * Merchant API and to monitor product issues + data-source status.
 * Guarded by a shared secret (see routes/general/merchant.ts).
 */
class MerchantApiController {
  private ensureConfigured(res: Response): boolean {
    if (!MerchantApiService.isConfigured()) {
      res.status(503).json({
        success: false,
        message:
          'Merchant API not configured. Set GOOGLE_MERCHANT_ACCOUNT_ID, GOOGLE_MERCHANT_DATA_SOURCE and service-account credentials.',
      });
      return false;
    }
    return true;
  }

  /** POST /merchant/sync — full catalogue sync (add/manage + frequent updates). */
  syncAll = async (req: Request, res: Response) => {
    if (!this.ensureConfigured(res)) return;
    try {
      const result = await MerchantApiService.syncAllProducts();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Merchant sync failed:', error);
      res.status(500).json({
        success: false,
        message: 'Merchant sync failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /** POST /merchant/products/:productId — upsert one product by Mongo id. */
  upsertOne = async (req: Request, res: Response) => {
    if (!this.ensureConfigured(res)) return;
    try {
      const product = await Product.findById(req.params.productId)
        .populate('category', 'name slug')
        .lean();
      if (!product) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return;
      }
      const result = await MerchantApiService.upsertProduct(product as never);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Merchant upsert failed:', error);
      res.status(500).json({
        success: false,
        message: 'Merchant upsert failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /** DELETE /merchant/products/:offerId — remove a product from Merchant Center. */
  deleteOne = async (req: Request, res: Response) => {
    if (!this.ensureConfigured(res)) return;
    try {
      await MerchantApiService.deleteProduct(req.params.offerId);
      res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
      console.error('Merchant delete failed:', error);
      res.status(500).json({
        success: false,
        message: 'Merchant delete failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /** GET /merchant/issues — list products with data issues (disapprovals/warnings). */
  issues = async (req: Request, res: Response) => {
    if (!this.ensureConfigured(res)) return;
    try {
      const data = await MerchantApiService.listProductIssues();
      res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('Merchant issues fetch failed:', error);
      res.status(500).json({
        success: false,
        message: 'Merchant issues fetch failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /** GET /merchant/datasource-status — monitor data-source + upload status. */
  dataSourceStatus = async (req: Request, res: Response) => {
    if (!this.ensureConfigured(res)) return;
    try {
      const data = await MerchantApiService.getDataSourcesStatus();
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Merchant data-source status failed:', error);
      res.status(500).json({
        success: false,
        message: 'Merchant data-source status failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

export default new MerchantApiController();
