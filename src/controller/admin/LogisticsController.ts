import { Request, Response } from 'express';
import LogisticsService from '@/services/LogisticsService';

const upsertConfig = async (req: Request, res: Response) => {
  try {
    const response = await LogisticsService.upsertConfig(req.body);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin upsert logistics config error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

const getByCountry = async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const response = await LogisticsService.getConfigByCountry(countryCode);
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
    const { countryCode } = req.params as { countryCode: string };
    const response = await LogisticsService.deleteCountry(countryCode);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin delete country error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

const updateCountryName = async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params as { countryCode: string };
    const { countryName } = req.body as { countryName: string };
    const response = await LogisticsService.updateCountryName(countryCode, countryName);
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Admin update country name error:', error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

export default { upsertConfig, getByCountry, listCountries, createEmptyCountry, deleteCountry, updateCountryName };
