import { Request, Response } from 'express';
import LogisticsService from '@/services/LogisticsService';

const createConfig = async (req: Request, res: Response) => {
  try {
    const response = await LogisticsService.createConfig(req.body);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin create logistics config error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

const updateConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const response = await LogisticsService.updateConfig(id, req.body);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin update logistics config error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

const getByCountry = async (req: Request, res: Response) => {
  try {
    const { country } = req.params;
    const response = await LogisticsService.getConfigByCountry(country);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin get logistics config error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

const listCountries = async (_req: Request, res: Response) => {
  try {
    const response = await LogisticsService.listCountries();
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin list logistics countries error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

const createEmptyCountry = async (req: Request, res: Response) => {
  try {
    const { countryCode, countryName } = req.body as { countryCode: string; countryName: string };
    const response = await LogisticsService.createEmptyCountry(countryCode, countryName);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin create empty country error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

const deleteCountry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const response = await LogisticsService.deleteCountry(id);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin delete country error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

export default {
  createConfig,
  updateConfig,
  getByCountry,
  listCountries,
  createEmptyCountry,
  deleteCountry,
};
