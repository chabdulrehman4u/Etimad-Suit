import mongoose from 'mongoose';

const navItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isExternal: { type: Boolean, default: false },
  },
  { _id: false }
);

const footerLinkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const footerColumnSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    links: [footerLinkSchema],
  },
  { _id: false }
);

const socialLinkSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'twitter', 'linkedin'],
      required: true,
    },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'hero_banner',
        'featured_categories',
        'product_carousel',
        'promotional_banner',
        'trust_badges',
        'rich_text',
        'newsletter',
        'custom_html',
      ],
      required: true,
    },
    title: { type: String, default: '', trim: true },
    subtitle: { type: String, default: '', trim: true },
    order: { type: Number, default: 0 },
    isEnabled: { type: Boolean, default: true },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: false }
);

const storefrontThemeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },

    // 1. Branding & Assets
    branding: {
      logoUrl: { type: String, default: '' },
      mobileLogoUrl: { type: String, default: '' },
      faviconUrl: { type: String, default: '' },
      storeTagline: { type: String, default: 'Your One-Stop Shop' },
    },

    // 2. Dynamic Colors Engine
    colors: {
      primary: { type: String, default: '#0284c7' },       // Brand Primary
      secondary: { type: String, default: '#0f172a' },     // Brand Secondary
      accent: { type: String, default: '#f59e0b' },        // Highlights / Badges
      background: { type: String, default: '#ffffff' },    // Page Background
      surface: { type: String, default: '#f8fafc' },       // Cards / Surface
      textPrimary: { type: String, default: '#0f172a' },   // Main Text
      textSecondary: { type: String, default: '#64748b' }, // Subtext / Muted
      topbarBg: { type: String, default: '#0284c7' },
      topbarText: { type: String, default: '#ffffff' },
      headerBg: { type: String, default: '#ffffff' },
      headerText: { type: String, default: '#0f172a' },
      footerBg: { type: String, default: '#0f172a' },
      footerText: { type: String, default: '#f8fafc' },
    },

    // 3. Dynamic Typography
    typography: {
      fontFamily: { type: String, default: 'Inter, sans-serif' },
      headingFont: { type: String, default: 'Inter, sans-serif' },
      baseFontSize: { type: String, default: '16px' },
    },

    // 4. Dynamic Announcement Topbar
    topbar: {
      enabled: { type: Boolean, default: true },
      text: {
        type: String,
        default: 'Welcome! Free shipping nationwide on orders over Rs. 3,000.',
      },
      link: { type: String, default: '' },
    },

    // 5. Dynamic Header & Navigation
    header: {
      sticky: { type: Boolean, default: true },
      showSearchBar: { type: Boolean, default: true },
      navigationMenu: {
        type: [navItemSchema],
        default: () => [
          { label: 'Home', url: '/', order: 1, isExternal: false },
          { label: 'Shop All', url: '/shop', order: 2, isExternal: false },
          { label: 'Hot Deals', url: '/deals', order: 3, isExternal: false },
          { label: 'Track Order', url: '/track', order: 4, isExternal: false },
          { label: 'Contact Us', url: '/contact', order: 5, isExternal: false },
        ],
      },
    },

    // 6. Dynamic Section-Based Homepage Builder (CMS)
    homepageLayout: {
      draftSections: {
        type: [sectionSchema],
        default: () => [
          {
            id: 'sec_hero_1',
            type: 'hero_banner',
            title: 'Discover Premium Quality',
            subtitle: 'Best prices & authentic products delivered straight to your door.',
            order: 1,
            isEnabled: true,
            settings: {
              slides: [
                {
                  title: 'New Season Collection',
                  subtitle: 'Explore our latest arrivals with Cash on Delivery.',
                  desktopImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
                  mobileImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
                  ctaText: 'Shop Now',
                  ctaLink: '/shop',
                },
              ],
            },
          },
          {
            id: 'sec_trust_1',
            type: 'trust_badges',
            title: 'Why Buy From Us',
            subtitle: '',
            order: 2,
            isEnabled: true,
            settings: {
              badges: [
                { icon: 'truck', title: 'Free Delivery', description: 'On orders over Rs. 3,000' },
                { icon: 'shield-check', title: 'Cash on Delivery', description: 'Pay at your doorstep' },
                { icon: 'refresh-cw', title: '7-Day Return', description: 'Hassle-free exchange policy' },
                { icon: 'headphones', title: '24/7 Support', description: 'Quick WhatsApp assistance' },
              ],
            },
          },
          {
            id: 'sec_categories_1',
            type: 'featured_categories',
            title: 'Shop by Category',
            subtitle: 'Browse through our top collections',
            order: 3,
            isEnabled: true,
            settings: { layout: 'grid', limit: 6 },
          },
          {
            id: 'sec_products_1',
            type: 'product_carousel',
            title: 'Featured Products',
            subtitle: 'Hand-picked bestsellers for you',
            order: 4,
            isEnabled: true,
            settings: { collection: 'featured', limit: 8 },
          },
          {
            id: 'sec_newsletter_1',
            type: 'newsletter',
            title: 'Stay Updated',
            subtitle: 'Subscribe to get exclusive discount vouchers and alerts.',
            order: 5,
            isEnabled: true,
            settings: { buttonText: 'Subscribe', placeholder: 'Enter your email' },
          },
        ],
      },
      publishedSections: {
        type: [sectionSchema],
        default: () => [
          {
            id: 'sec_hero_1',
            type: 'hero_banner',
            title: 'Discover Premium Quality',
            subtitle: 'Best prices & authentic products delivered straight to your door.',
            order: 1,
            isEnabled: true,
            settings: {
              slides: [
                {
                  title: 'New Season Collection',
                  subtitle: 'Explore our latest arrivals with Cash on Delivery.',
                  desktopImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
                  mobileImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
                  ctaText: 'Shop Now',
                  ctaLink: '/shop',
                },
              ],
            },
          },
          {
            id: 'sec_trust_1',
            type: 'trust_badges',
            title: 'Why Buy From Us',
            subtitle: '',
            order: 2,
            isEnabled: true,
            settings: {
              badges: [
                { icon: 'truck', title: 'Free Delivery', description: 'On orders over Rs. 3,000' },
                { icon: 'shield-check', title: 'Cash on Delivery', description: 'Pay at your doorstep' },
                { icon: 'refresh-cw', title: '7-Day Return', description: 'Hassle-free exchange policy' },
                { icon: 'headphones', title: '24/7 Support', description: 'Quick WhatsApp assistance' },
              ],
            },
          },
          {
            id: 'sec_categories_1',
            type: 'featured_categories',
            title: 'Shop by Category',
            subtitle: 'Browse through our top collections',
            order: 3,
            isEnabled: true,
            settings: { layout: 'grid', limit: 6 },
          },
          {
            id: 'sec_products_1',
            type: 'product_carousel',
            title: 'Featured Products',
            subtitle: 'Hand-picked bestsellers for you',
            order: 4,
            isEnabled: true,
            settings: { collection: 'featured', limit: 8 },
          },
          {
            id: 'sec_newsletter_1',
            type: 'newsletter',
            title: 'Stay Updated',
            subtitle: 'Subscribe to get exclusive discount vouchers and alerts.',
            order: 5,
            isEnabled: true,
            settings: { buttonText: 'Subscribe', placeholder: 'Enter your email' },
          },
        ],
      },
      publishedAt: { type: Date, default: Date.now },
    },

    // 7. Dynamic Footer Builder
    footer: {
      aboutText: {
        type: String,
        default: 'Your trusted store for genuine products at unmatched prices across Pakistan.',
      },
      columns: {
        type: [footerColumnSchema],
        default: () => [
          {
            title: 'Quick Links',
            links: [
              { label: 'Shop All', url: '/shop' },
              { label: 'Track Order', url: '/track' },
              { label: 'Special Deals', url: '/deals' },
            ],
          },
          {
            title: 'Customer Care',
            links: [
              { label: 'Return & Exchange Policy', url: '/returns' },
              { label: 'Shipping Policy', url: '/shipping' },
              { label: 'Privacy Policy', url: '/privacy' },
              { label: 'Terms of Service', url: '/terms' },
            ],
          },
        ],
      },
      contactInfo: {
        address: { type: String, default: 'Karachi, Pakistan' },
        phone: { type: String, default: '0300-1234567' },
        whatsapp: { type: String, default: '0300-1234567' },
        email: { type: String, default: 'support@store.com' },
      },
      socialLinks: {
        type: [socialLinkSchema],
        default: () => [
          { platform: 'facebook', url: 'https://facebook.com' },
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'whatsapp', url: 'https://wa.me/923001234567' },
        ],
      },
      copyright: {
        type: String,
        default: '© 2026 Etimad Suit. All rights reserved.',
      },
      showPaymentBadges: { type: Boolean, default: true },
    },

    // 8. Dynamic Functional Feature Toggles (Real-Time Feature Flags)
    features: {
      codEnabled: { type: Boolean, default: true },
      onlinePaymentEnabled: { type: Boolean, default: false },
      guestCheckoutEnabled: { type: Boolean, default: true },
      wholesalePortalEnabled: { type: Boolean, default: true },
      retailPosEnabled: { type: Boolean, default: true },
      showStockBadges: { type: Boolean, default: true },
      reviewsEnabled: { type: Boolean, default: true },
      wishlistEnabled: { type: Boolean, default: true },
      dealOfTheDayEnabled: { type: Boolean, default: true },
      whatsappChatWidgetEnabled: { type: Boolean, default: true },
      whatsappNumber: { type: String, default: '' },
    },

    // 9. Custom CSS Override (Optional for advanced merchant design)
    customCss: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const StorefrontTheme = mongoose.model('StorefrontTheme', storefrontThemeSchema);
export default StorefrontTheme;
