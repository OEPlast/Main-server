import { Request } from 'express';
import type { AuthenticatedRequest } from '@/types';
import { handle } from '@/controller/ContentController';
import SupportService, { TicketStatus } from '@/services/support/supportService';
import StockAlertService from '@/services/support/stockAlertService';
import PickupService from '@/services/pickup/pickupService';
import getShippingOptions from '@/services/checkout/shippingOptions';

const num = (v: unknown) => (v == null || v === '' ? undefined : Number(v));
const userId = (req: Request) => (req as AuthenticatedRequest).userId;

const SupportController = {
  // public
  createTicket: handle('createTicket', (req) =>
    SupportService.createTicket({ ...req.body, userId: userId(req) })
  ),
  createStockAlert: handle('createStockAlert', (req) =>
    StockAlertService.createAlert(String(req.params.productId), req.body, userId(req))
  ),
  listPickupLocations: handle('listPickupLocations', () => PickupService.listActive()),
  shippingOptions: handle('shippingOptions', (req) => getShippingOptions(req.body)),

  // admin: tickets
  listTickets: handle('listTickets', (req) =>
    SupportService.listTickets({
      status: (req.query.status as TicketStatus) || undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: num(req.query.page),
      limit: num(req.query.limit),
    })
  ),
  getTicket: handle('getTicket', (req) => SupportService.getTicket(String(req.params.id))),
  updateTicket: handle('updateTicket', (req) => SupportService.updateStatus(String(req.params.id), req.body.status)),
  addTicketNote: handle('addTicketNote', (req) => SupportService.addNote(String(req.params.id), req.body, userId(req))),

  // admin: stock alerts
  stockAlertSummary: handle('stockAlertSummary', (req) =>
    StockAlertService.summary({ page: num(req.query.page), limit: num(req.query.limit) })
  ),
  stockAlertsForProduct: handle('stockAlertsForProduct', (req) =>
    StockAlertService.listForProduct(String(req.params.productId))
  ),

  // admin: pickup locations
  adminListPickup: handle('adminListPickup', () => PickupService.listAll()),
  createPickup: handle('createPickup', (req) => PickupService.create(req.body)),
  updatePickup: handle('updatePickup', (req) => PickupService.update(String(req.params.id), req.body)),
  deletePickup: handle('deletePickup', (req) => PickupService.remove(String(req.params.id))),
};

export default SupportController;
