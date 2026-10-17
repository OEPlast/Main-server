/*
 * Pickup at a GIG service centre: the quote asks for service-centre pickup at the centre's station
 * and position, and the booking sends GIG the centre (DestinationServiceCenterId). GIG's API and
 * the GIG settings are stubbed; nothing leaves the machine.
 */
import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import GIGConfig from '@/models/GIGConfig';
import GIGService from '@/services/GIGService';
import { GIG_PICKUP_OPTION, type GIGPickupCentre } from '@/types/gig';

const config = {
  senderName: 'Doreti',
  senderPhoneNumber: '09000000000',
  senderAddress: '12 Admiralty Way, Lekki',
  senderLocality: 'Lekki',
  senderStationId: 4,
  senderLatitude: 6.4477,
  senderLongitude: 3.4671,
  customerCode: 'ECO000000',
  vehicleType: 'BIKE',
  enabledDeliveryMethods: ['shipping', 'pickup', 'gig'],
  isActive: true,
};

const centre: GIGPickupCentre = {
  id: 64,
  name: 'PHC 2 ALAKAHIA',
  code: 'PH2',
  address: 'Linus Book Shop Building, Alakahia',
  stationId: 30,
  latitude: 4.8856,
  longitude: 6.9315,
};

const order = {
  items: [{ name: 'Necklace', quantity: 1, weight: 0.2, height: 5, width: 10, length: 10, isVolumetric: false, value: 45000 }],
  receiverAddress: centre.address,
  receiverState: 'Rivers',
  receiverName: 'Ada Obi',
  receiverPhoneNumber: '08011111111',
  serviceCentre: centre,
};

describe('pickup at a GIG service centre', () => {
  const sent: Array<{ url: string; body: Record<string, any> }> = []; // eslint-disable-line @typescript-eslint/no-explicit-any

  before(() => {
    mock.method(GIGConfig, 'findOne', () => ({ lean: async () => config }));
    mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
      sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {} });
      const data = String(url).endsWith('/price/v3')
        ? { GrandTotal: 10383.82, DeliveryPrice: 9669, Vat: 0, Discount: 0, InsurancePrice: 0, SurchargeFee: 0 }
        : String(url).endsWith('/localstations/get')
          ? [{ StationId: 30, StationName: 'PORT HARCOURT', StateName: 'RIVERS' }]
          : { Waybill: 'WB123' };
      return new Response(JSON.stringify({ message: 'Success', status: 200, data }), { status: 200 });
    });
  });
  after(() => mock.restoreAll());

  test('the quote is for service-centre pickup at the centre', async () => {
    sent.length = 0;
    const quote = await GIGService.calculateShipping(order);
    assert.equal(quote.code, 200, quote.message);
    const price = sent.find((r) => r.url.endsWith('/price/v3'))!.body;
    assert.equal(price.ReceiverStationId, 30);
    assert.equal(price.PickUpOptions, GIG_PICKUP_OPTION.ServiceCentre);
    assert.deepEqual(price.ReceiverLocation, { Latitude: centre.latitude, Longitude: centre.longitude });
    // The station comes from the centre, so GIG's station list is never needed.
    assert.ok(!sent.some((r) => r.url.includes('/localstations')));
  });

  test('the booking sends GIG the centre', async () => {
    sent.length = 0;
    const booked = await GIGService.createShipmentForOrder(order);
    assert.equal(booked.data?.waybillNumber, 'WB123', booked.message);
    const receiver = sent.find((r) => r.url.endsWith('/capture/preshipment'))!.body.ReceiverDetails;
    assert.equal(receiver.DestinationServiceCenterId, 64);
    assert.equal(receiver.ReceiverStationId, 30);
    assert.equal(receiver.ReceiverName, 'Ada Obi');
    assert.equal(receiver.ReceiverAddress, `${centre.name}, ${centre.address}`);
  });

  test('door delivery sends no centre', async () => {
    sent.length = 0;
    const { serviceCentre: _, ...door } = order;
    await GIGService.createShipmentForOrder({ ...door, receiverLatitude: 4.8, receiverLongitude: 7.0 });
    const receiver = sent.find((r) => r.url.endsWith('/capture/preshipment'))?.body.ReceiverDetails;
    assert.ok(receiver, 'booked');
    assert.equal(receiver.DestinationServiceCenterId, undefined);
  });
});
