/**
 * Design System Utilities and Theme Injector for Etimad Suit SaaS
 */

/**
 * Format currency amounts in Pakistani Rupees
 */
export const formatPKR = (amount, symbol = 'Rs.') => {
  const numeric = Number(amount) || 0;
  return `${symbol} ${numeric.toLocaleString('en-PK')}`;
};

/**
 * Color mapping for order statuses
 */
export const getOrderStatusBadge = (status) => {
  switch (status?.toLowerCase()) {
    case 'delivered':
    case 'completed':
    case 'paid':
      return { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' };
    case 'dispatched':
      return { label: 'Dispatched', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
    case 'packed':
    case 'processing':
    case 'confirmed':
      return { label: 'Processing', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' };
    case 'cancelled':
    case 'returned':
    case 'failed':
      return { label: 'Cancelled', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' };
    default:
      return { label: status || 'Pending', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' };
  }
};

/**
 * Injects dynamic CSS variables into document root from tenant theme colors
 */
export const injectTenantThemeVariables = (branding) => {
  if (typeof document === 'undefined' || !branding) return;

  const root = document.documentElement;
  if (branding.primaryColor) root.style.setProperty('--color-primary', branding.primaryColor);
  if (branding.secondaryColor) root.style.setProperty('--color-secondary', branding.secondaryColor);
  if (branding.accentColor) root.style.setProperty('--color-accent', branding.accentColor);
  if (branding.backgroundColor) root.style.setProperty('--color-bg', branding.backgroundColor);
  if (branding.textColor) root.style.setProperty('--color-text', branding.textColor);
  if (branding.fontHeading) root.style.setProperty('--font-heading', branding.fontHeading);
  if (branding.fontBody) root.style.setProperty('--font-body', branding.fontBody);
};
