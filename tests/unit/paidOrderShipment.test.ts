/*
 * A paid "Deliver to me" order always gets a shipment, also when free delivery made its delivery
 * fee ₦0. Pickup orders never do. Runs fulfilPaidOrder with the shipment booking stubbed; no
 * database or broker is needed (their calls fail fast and are logged, as in production).
 */
import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import ShipmentService from '@/services/ShipmentService';
import { fulfilPaidOrder } from '@/services/orders/orderLifecycle';

type PaidOrder = Parameters<typeof fulfilPaidOrder>[0];
type PaidTransaction = Parameters<typeof fulfilPaidOrder>[1];

const order = (deliveryType: string, shippingPrice: number) =>
  ({ _id: new mongoose.Types.ObjectId(), deliveryType, shippingPrice, isPaid: true, status: 'Processing' }) as unknown as PaidOrder;
const transaction = { _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(), amount: 0, reference: 'ref' } as unknown as PaidTransaction;

describe('shipment for a paid order', () => {
  const createShipment = mock.method(ShipmentService, 'createShipmentForOrder', async () => null);

  before(() => {
    // Without a connection, queries fail at once instead of waiting to connect.
    mongoose.set('bufferCommands', false);
  });
  after(() => mock.restoreAll());

  test('free delivery (₦0) still creates a shipment', async () => {
    createShipment.mock.resetCalls();
    const free = order('shipping', 0);
    await fulfilPaidOrder(free, transaction);
    assert.equal(createShipment.mock.callCount(), 1);
    assert.equal(createShipment.mock.calls[0]!.arguments[0], free._id.toString());
  });

  test('paid delivery creates a shipment', async () => {
    createShipment.mock.resetCalls();
    await fulfilPaidOrder(order('shipping', 1210), transaction);
    assert.equal(createShipment.mock.callCount(), 1);
  });

  test('pickup creates no shipment', async () => {
    createShipment.mock.resetCalls();
    await fulfilPaidOrder(order('pickup', 0), transaction);
    assert.equal(createShipment.mock.callCount(), 0);
  });
});
