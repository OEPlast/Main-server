import Settings, { type SettingsType } from '@/models/Settings';
import { CustomResponseType } from '@/types';

const getSettings = async (): Promise<CustomResponseType<SettingsType | null>> => {
  try {
    const doc = await Settings.findOne().sort({ createdAt: -1 });
    return { message: 'Settings retrieved', data: doc, code: 200 };
  } catch (e) {
    console.error('getSettings error:', e);
    return { message: 'Failed to get settings', data: null, code: 500 };
  }
};

const upsertSettings = async (payload: Partial<SettingsType>): Promise<CustomResponseType<SettingsType | null>> => {
  try {
    const existing = await Settings.findOne();
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      return { message: 'Settings updated', data: existing, code: 200 };
    }
    const created = await Settings.create(payload);
    return { message: 'Settings created', data: created, code: 201 };
  } catch (e) {
    console.error('upsertSettings error:', e);
    return { message: 'Failed to upsert settings', data: null, code: 500 };
  }
};

export default { getSettings, upsertSettings };
