/**
 * Email Template Engine
 * Handlebars-based email template rendering with custom helpers
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { formatToNaira } from './currencyFormatter';
import { getCdnUrl } from './cdn-url';

/**
 * Formats a date to readable format: "Nov 9, 2022 10:12 AM"
 */
function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const month = months[dateObj.getMonth()];
  const day = dateObj.getDate();
  const year = dateObj.getFullYear();
  
  let hours = dateObj.getHours();
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  
  return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
}

/**
 * Register Handlebars helpers
 * Only includes helpers that are template-specific logic
 */
export function registerHelpers(): void {
  // Currency formatter - Nigerian Naira formatting
  Handlebars.registerHelper('currency', function(amount: number): string {
    return formatToNaira(amount);
  });
  
  // Date formatter - used in templates for consistent date display
  Handlebars.registerHelper('formatDate', function(date: any): string {
    return formatDate(date);
  });
  
  // CDN URL helper - constructs CDN URLs for images
  Handlebars.registerHelper('cdnUrl', function(imagePath: string): string {
    return getCdnUrl(imagePath);
  });
  
  // Equality helper - for conditional rendering
  Handlebars.registerHelper('eq', function(a: any, b: any): boolean {
    return a === b;
  });
  
  // Greater than helper - for conditional rendering (e.g., discount > 0)
  Handlebars.registerHelper('gt', function(a: any, b: any): boolean {
    return a > b;
  });
}

/**
 * Compile and render an email template
 * Note: Templates are NOT cached - they are compiled on each render for development flexibility
 * 
 * @param templateName - Name of the template file (without .html extension)
 * @param data - Data object to pass to the template
 * @returns Rendered HTML string
 * 
 * @example
 * const html = renderEmailTemplate('welcome', {
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   email: 'john@example.com',
 *   welcomeImageUrl: 'banners/welcome.jpg',
 *   companyName: 'OEPlast'
 * });
 */
export function renderEmailTemplate(templateName: string, data: any): string {
  // Register helpers on each call (idempotent operation)
  registerHelpers();
  
  // Construct path to template file
  const templatePath = path.join(__dirname, '../mails', `${templateName}.html`);
  
  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}`);
  }
  
  // Read template file
  const templateSource = fs.readFileSync(templatePath, 'utf-8');
  
  // Compile template (no caching)
  const template = Handlebars.compile(templateSource, {compat: false});
  
  // Render template with data
  return template(data);
}

/**
 * Get list of available email templates
 */
export function getAvailableTemplates(): string[] {
  const mailsDir = path.join(__dirname, '../mails');
  
  if (!fs.existsSync(mailsDir)) {
    return [];
  }
  
  return fs.readdirSync(mailsDir)
    .filter(file => file.endsWith('.html'))
    .map(file => file.replace('.html', ''));
}
