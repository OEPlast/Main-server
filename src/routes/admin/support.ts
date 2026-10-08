import express from 'express';
import SupportController from '@/controller/SupportController';
import SupportValidator from '@/validators/SupportValidator';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';

/** Support inbox and back-in-stock alerts (mounted at /admin/support). */
export const adminSupportRouter = express.Router();
adminSupportRouter.use(authenticateUser, isAdmin);

adminSupportRouter.get('/tickets', requirePermission('support', 'read'), SupportController.listTickets);
adminSupportRouter.get('/tickets/:id', requirePermission('support', 'read'), ...SupportValidator.idParam, SupportController.getTicket);
adminSupportRouter.patch('/tickets/:id', requirePermission('support', 'update'), ...SupportValidator.ticketStatus, SupportController.updateTicket);
/** { text, email?: boolean } — email: true also sends the note to the customer */
adminSupportRouter.post('/tickets/:id/notes', requirePermission('support', 'update'), ...SupportValidator.ticketNote, SupportController.addTicketNote);

adminSupportRouter.get('/stock-alerts', requirePermission('support', 'read'), SupportController.stockAlertSummary);
adminSupportRouter.get('/stock-alerts/:productId', requirePermission('support', 'read'), SupportController.stockAlertsForProduct);

/** Pickup locations (mounted at /admin/pickup-locations). */
export const adminPickupRouter = express.Router();
adminPickupRouter.use(authenticateUser, isAdmin);

adminPickupRouter.get('/', requirePermission('pickup', 'read'), SupportController.adminListPickup);
adminPickupRouter.post('/', requirePermission('pickup', 'create'), ...SupportValidator.createPickup, SupportController.createPickup);
adminPickupRouter.patch('/:id', requirePermission('pickup', 'update'), ...SupportValidator.updatePickup, SupportController.updatePickup);
adminPickupRouter.delete('/:id', requirePermission('pickup', 'delete'), ...SupportValidator.idParam, SupportController.deletePickup);
