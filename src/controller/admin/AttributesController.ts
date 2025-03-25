import { Request, Response } from 'express';
import Admin_AttributesService from '@/services/admin/AttributesService';

const getAllAttributes = async (req: Request, res: Response) => {
  try {
    const { data, code, message } = await Admin_AttributesService.allAttributes();
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in getAllAttributes:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const createAttribute = async (req: Request, res: Response) => {
  try {
    const { name, children } = req.body;
    const { data, code, message } = await Admin_AttributesService.createAttribute({ name, children });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in createAttribute:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const updateAttribute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, children } = req.body;
    const { data, code, message } = await Admin_AttributesService.updateAttribute({ id, data: { name, children } });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in updateAttribute:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const deleteAttribute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, code, message } = await Admin_AttributesService.deleteAttribute(id);
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in deleteAttribute:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const AttributesController = {
  getAllAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
};

export default AttributesController;
