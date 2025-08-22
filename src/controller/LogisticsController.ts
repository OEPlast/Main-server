import ShipmentService from '@/services/admin/ShipmentService';
import LogisticsService from '@/services/LogisticsService';
import { Request, Response } from 'express';
const trackOrder = async (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.params;
    const result = await ShipmentService.trackShipment(trackingNumber);
    return res.status(result.code).json({ message: result.message, data: result.data, code: result.code });
  } catch (error) {
    console.error('Error tracking shipment:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const quote = async (req: Request, res: Response) => {
  try {
    const response = await LogisticsService.quote(req.body);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error generating quote:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const getConfig = async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const response = await LogisticsService.getConfigByCountry(countryCode);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error fetching logistics config:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const listCountries = async (_req: Request, res: Response) => {
  try {
    const response = await LogisticsService.listCountries();
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error listing logistics countries:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const listLocationsTree = async (_req: Request, res: Response) => {
  try {
    const response = await LogisticsService.listLocationsTree();
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error listing logistics locations tree:', error);
    return res.status(500).json({ message: 'Internal server error', data: null, code: 500 });
  }
};

const LogisticsController = { trackOrder, quote, getConfig, listCountries, listLocationsTree };
export default LogisticsController;
