import { CustomResponseType } from '@/types';
import Settings, { SettingsType } from '../models/Settings';

// Settings input types
interface UpdateSettingsInput {
  storeName?: string;
  companyName?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  taxId?: string;
  taxRate?: number;
  currency?: string;
  timezone?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    x?: string;
    threads?: string;
  };
}

/**
 * Gets the store settings (singleton).
 * Creates default settings if none exist.
 * @returns A promise that resolves to a custom response containing the settings.
 */
const getSettings = async (): Promise<CustomResponseType<SettingsType>> => {
  try {
    let settings = await Settings.findOne();

    // If no settings exist, create default settings
    if (!settings) {
      settings = new Settings({});
      await settings.save();
    }

    return {
      message: 'Settings fetched successfully',
      data: settings,
      code: 200,
    };
  } catch (error) {
    console.log('Error fetching settings:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to fetch settings',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates the store settings (singleton).
 * Creates settings if none exist.
 * @param settingsData - The data to update.
 * @returns A promise that resolves to a custom response containing the updated settings.
 */
const updateSettings = async (settingsData: UpdateSettingsInput): Promise<CustomResponseType<SettingsType>> => {
  try {
    // Find existing settings or create new one
    let settings = await Settings.findOne();

    if (!settings) {
      // Create new settings with provided data
      settings = new Settings(settingsData);
      await settings.save();

      return {
        message: 'Settings created successfully',
        data: settings,
        code: 201,
      };
    }

    // Update existing settings
    Object.assign(settings, settingsData);
    await settings.save();

    return {
      message: 'Settings updated successfully',
      data: settings,
      code: 200,
    };
  } catch (error) {
    console.log('Error updating settings:', error);
    return {
      message: error instanceof Error ? error.message : 'Failed to update settings',
      data: null,
      code: 500,
    };
  }
};

const SettingsService = {
  getSettings,
  updateSettings,
};

export default SettingsService;
