/**
 * Store policy numbers quoted to customers. One definition, read by enforcement (returnService),
 * emails, the public branding endpoint (so the storefront's policy pages, product page and FAQ
 * show the same figures) and nothing else.
 *
 * These used to be scattered: 7 days in the returns code and emails, "2 Day Returns" on the
 * product page and homepage, a second 7 inside the Return model, and two refund ETAs.
 */

/** Days after delivery a customer may request a return. */
export const RETURN_WINDOW_DAYS = 7;

/** Business days a card refund through Paystack typically takes to reach the customer. */
export const REFUND_ETA_DAYS = 7;
