import PickupLocation from '@/models/PickupLocation';
import { CustomResponseType } from '@/types';
import { requestStorefrontRevalidation, StorefrontTag } from '@/services/storefront/revalidate';

type Input = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  hours?: string;
  readyIn?: string;
  active?: boolean;
  order?: number;
};

const purge = () => requestStorefrontRevalidation([StorefrontTag.PICKUP_LOCATIONS, StorefrontTag.DELIVERY_CONFIG]);

/** Locations shown at checkout (active only). */
const listActive = async (): Promise<CustomResponseType<unknown[]>> => {
  try {
    const items = await PickupLocation.find({ active: true }).sort({ order: 1, name: 1 }).lean();
    return { message: 'Pickup locations retrieved successfully', data: items, code: 200 };
  } catch (error) {
    console.error('Error listing pickup locations:', error);
    return { message: 'Failed to retrieve pickup locations', data: null, code: 500 };
  }
};

const listAll = async (): Promise<CustomResponseType<unknown[]>> => {
  try {
    return { message: 'Pickup locations retrieved successfully', data: await PickupLocation.find().sort({ order: 1, name: 1 }).lean(), code: 200 };
  } catch (error) {
    console.error('Error listing pickup locations:', error);
    return { message: 'Failed to retrieve pickup locations', data: null, code: 500 };
  }
};

const create = async (input: Input): Promise<CustomResponseType<unknown>> => {
  try {
    const location = await PickupLocation.create(input);
    purge();
    return { message: 'Pickup location created successfully', data: location, code: 201 };
  } catch (error) {
    console.error('Error creating pickup location:', error);
    return { message: 'Failed to create pickup location', data: null, code: 500 };
  }
};

const update = async (id: string, input: Input): Promise<CustomResponseType<unknown>> => {
  try {
    const location = await PickupLocation.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    if (!location) return { message: 'Pickup location not found', data: null, code: 404 };
    purge();
    return { message: 'Pickup location updated successfully', data: location, code: 200 };
  } catch (error) {
    console.error('Error updating pickup location:', error);
    return { message: 'Failed to update pickup location', data: null, code: 500 };
  }
};

const remove = async (id: string): Promise<CustomResponseType<null>> => {
  try {
    const location = await PickupLocation.findByIdAndDelete(id);
    if (!location) return { message: 'Pickup location not found', data: null, code: 404 };
    purge();
    return { message: 'Pickup location deleted successfully', data: null, code: 200 };
  } catch (error) {
    console.error('Error deleting pickup location:', error);
    return { message: 'Failed to delete pickup location', data: null, code: 500 };
  }
};

/** The order snapshot for a chosen active location, or null when it doesn't exist / is inactive. */
const snapshot = async (id: string) => {
  const loc = await PickupLocation.findOne({ _id: id, active: true }).lean();
  if (!loc) return null;
  return {
    locationId: loc._id,
    name: loc.name,
    address: loc.address,
    city: loc.city,
    state: loc.state,
    phone: loc.phone ?? undefined,
    hours: loc.hours ?? undefined,
  };
};

const PickupService = { listActive, listAll, create, update, remove, snapshot };
export default PickupService;
