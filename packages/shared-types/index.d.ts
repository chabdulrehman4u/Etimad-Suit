export type OrderChannel = 'online' | 'retail' | 'wholesale';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'returned';
export type PaymentMethod = 'cod' | 'cash' | 'card' | 'bank_transfer' | 'credit';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type StockMovementType = 'PURCHASE_RECEIPT' | 'SALE_DEDUCTION' | 'STOCK_RESERVE' | 'STOCK_RELEASE' | 'RETURN_RESTOCK' | 'ADJUSTMENT' | 'TRANSFER';
export type CourierProvider = 'lcs' | 'postex' | 'mnp' | 'trax';

export interface TenantBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontHeading?: string;
  fontBody?: string;
}

export interface StorefrontBundle {
  tenant: {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    logoUrl?: string;
    contactPhone?: string;
    contactEmail?: string;
    currency: string;
    currencySymbol: string;
  };
  branding: TenantBranding;
  topbar?: {
    isEnabled: boolean;
    announcementText?: string;
  };
  homepage: {
    sections: Array<{
      id: string;
      type: string;
      title?: string;
      isEnabled: boolean;
      order: number;
      settings: Record<string, any>;
    }>;
  };
  footer: {
    columns: Array<{
      title: string;
      links: Array<{ label: string; url: string }>;
    }>;
    copyrightText?: string;
    socialLinks?: {
      facebook?: string;
      instagram?: string;
      whatsapp?: string;
    };
  };
  features: {
    showStockBadge?: boolean;
    enableReviews?: boolean;
    guestCheckoutAllowed?: boolean;
    codAllowed?: boolean;
  };
}

export interface ProductCatalogItem {
  _id: string;
  name: string;
  slug: string;
  sku?: string;
  category?: string;
  description?: string;
  pricing: {
    retailPrice: number;
    websitePrice: number;
  };
  stock: number;
  isOutOfStock: boolean;
  images: Array<{ url: string; alt?: string; isPrimary: boolean }>;
}

export interface CartCalculationResult {
  lineItems: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPriceSnapshot: number;
    lineTotal: number;
  }>;
  financials: {
    subtotal: number;
    shippingFee: number;
    discountTotal: number;
    grandTotal: number;
  };
  appliedCoupon?: {
    code: string;
    type: string;
    amount: number;
  };
}

