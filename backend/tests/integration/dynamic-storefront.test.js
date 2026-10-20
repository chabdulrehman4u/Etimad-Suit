import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Tenant } from '../../src/modules/tenants/Tenant.js';
import { StorefrontTheme } from '../../src/modules/storefront/StorefrontTheme.js';

describe('Dynamic Storefront, Colors, Homepage CMS, and Footer Suite', () => {
  let app;
  let sellerAToken, sellerBToken;
  let tenantA, tenantB;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 180000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Register Seller A
    const resA = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Luxe Apparel',
        slug: 'luxe-apparel',
        subdomain: 'luxe',
        ownerName: 'Zainab Bibi',
        email: 'zainab@luxe.com',
        password: 'Password123!',
        phone: '03001234567',
      });

    sellerAToken = resA.body.data.token;
    tenantA = resA.body.data.tenant;

    // 2. Register Seller B
    const resB = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Tech Haven',
        slug: 'tech-haven',
        subdomain: 'tech',
        ownerName: 'Bilal Tariq',
        email: 'bilal@tech.com',
        password: 'Password123!',
        phone: '03007654321',
      });

    sellerBToken = resB.body.data.token;
    tenantB = resB.body.data.tenant;
  });

  // TEST 1: Dynamic Theme & Color Customization
  it('1. Allows merchant to dynamically change store design colors anytime and reflects on public config', async () => {
    // Check initial default colors
    const initRes = await request(app)
      .get('/api/v1/storefront/theme')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(initRes.status).toBe(200);
    expect(initRes.body.data.colors.primary).toBe('#0284c7');

    // Merchant updates brand colors to Rose & Dark Slate
    const updateRes = await request(app)
      .put('/api/v1/storefront/theme')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        colors: {
          primary: '#e11d48',    // Rose 600
          secondary: '#1e293b',  // Slate 800
          accent: '#10b981',     // Emerald 500
          footerBg: '#09090b',   // Zinc 950
          footerText: '#fafafa',
        },
        branding: {
          storeTagline: 'Redefining Eastern Elegance',
          logoUrl: 'https://cdn.etimadsuit.com/luxe/logo.png',
        },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.colors.primary).toBe('#e11d48');
    expect(updateRes.body.data.colors.footerBg).toBe('#09090b');
    expect(updateRes.body.data.branding.storeTagline).toBe('Redefining Eastern Elegance');

    // Public visitor visits the store and retrieves public config
    const publicRes = await request(app)
      .get('/api/v1/storefront/config')
      .set('x-tenant-id', tenantA._id);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.colors.primary).toBe('#e11d48');
    expect(publicRes.body.data.colors.footerBg).toBe('#09090b');
    expect(publicRes.body.data.branding.storeTagline).toBe('Redefining Eastern Elegance');
    expect(publicRes.body.data.store.name).toBe('Luxe Apparel');
  });

  // TEST 2: Dynamic Footer Customization
  it('2. Dynamically configures footer columns, contact details, social links, and copyright', async () => {
    const customFooter = {
      aboutText: 'Luxe Apparel offers bespoke haute couture crafted with authentic Pakistani silk.',
      columns: [
        {
          title: 'Collections',
          links: [
            { label: 'Bridal 2026', url: '/collections/bridal' },
            { label: 'Pret Wear', url: '/collections/pret' },
            { label: 'Silk Shawls', url: '/collections/shawls' },
          ],
        },
        {
          title: 'Assistance',
          links: [
            { label: 'Custom Fitting', url: '/custom-fitting' },
            { label: 'Worldwide Shipping', url: '/shipping-info' },
            { label: 'Returns & Exchange', url: '/returns' },
          ],
        },
      ],
      contactInfo: {
        address: 'Gulberg III, MM Alam Road, Lahore',
        phone: '042-35789000',
        whatsapp: '0300-9876543',
        email: 'concierge@luxeapparel.pk',
      },
      socialLinks: [
        { platform: 'instagram', url: 'https://instagram.com/luxeapparel' },
        { platform: 'facebook', url: 'https://facebook.com/luxeapparel' },
        { platform: 'tiktok', url: 'https://tiktok.com/@luxeapparel' },
      ],
      copyright: '© 2026 Luxe Apparel Pvt Ltd. Powered by Etimad Suit.',
      showPaymentBadges: true,
    };

    const res = await request(app)
      .put('/api/v1/storefront/theme')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ footer: customFooter });

    expect(res.status).toBe(200);
    expect(res.body.data.footer.aboutText).toContain('bespoke haute couture');
    expect(res.body.data.footer.columns.length).toBe(2);
    expect(res.body.data.footer.contactInfo.whatsapp).toBe('0300-9876543');

    // Verify on public endpoint
    const publicRes = await request(app)
      .get(`/api/v1/storefront/${tenantA.slug}/config`);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.footer.aboutText).toContain('bespoke haute couture');
    expect(publicRes.body.data.footer.columns[0].links[0].label).toBe('Bridal 2026');
    expect(publicRes.body.data.footer.socialLinks.length).toBe(3);
  });

  // TEST 3: Dynamic Homepage Section Builder (Draft vs Published)
  it('3. Supports dynamic section reordering, draft preview, and instant publishing to live storefront', async () => {
    // 1. Initial published sections count
    const initialConfig = await request(app)
      .get('/api/v1/storefront/config')
      .set('x-tenant-id', tenantA._id);

    expect(initialConfig.status).toBe(200);
    const initialSections = initialConfig.body.data.homepage.sections;
    expect(initialSections.length).toBeGreaterThan(0);

    // 2. Merchant creates a custom draft layout:
    // Puts promotional banner FIRST, then featured categories, then newsletter
    const customSections = [
      {
        id: 'sec_promo_ramadan',
        type: 'promotional_banner',
        title: 'Ramadan Mubarak Mega Sale',
        subtitle: 'Up to 50% off on all formal wear',
        order: 1,
        isEnabled: true,
        settings: {
          bannerImage: 'https://cdn.etimadsuit.com/banners/ramadan.jpg',
          targetUrl: '/deals/ramadan',
        },
      },
      {
        id: 'sec_cat_custom',
        type: 'featured_categories',
        title: 'Shop Trending Categories',
        order: 2,
        isEnabled: true,
        settings: { layout: 'carousel', limit: 4 },
      },
      {
        id: 'sec_news_custom',
        type: 'newsletter',
        title: 'VIP Exclusive Club',
        order: 3,
        isEnabled: true,
        settings: { buttonText: 'Join VIP' },
      },
    ];

    const draftRes = await request(app)
      .put('/api/v1/storefront/theme/sections')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ sections: customSections });

    expect(draftRes.status).toBe(200);
    expect(draftRes.body.data.length).toBe(3);

    // 3. IMPORTANT: Public storefront MUST STILL SHOW previous published sections (NOT unfinished draft)
    const midPublicRes = await request(app)
      .get('/api/v1/storefront/config')
      .set('x-tenant-id', tenantA._id);

    expect(midPublicRes.body.data.homepage.sections[0].id).toBe('sec_hero_1');

    // 4. Merchant hits "Publish Layout"
    const publishRes = await request(app)
      .post('/api/v1/storefront/theme/publish')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.publishedSections.length).toBe(3);
    expect(publishRes.body.data.publishedSections[0].id).toBe('sec_promo_ramadan');

    // 5. Public storefront now immediately serves the new published layout!
    const updatedPublicRes = await request(app)
      .get('/api/v1/storefront/config')
      .set('x-tenant-id', tenantA._id);

    expect(updatedPublicRes.body.data.homepage.sections.length).toBe(3);
    expect(updatedPublicRes.body.data.homepage.sections[0].title).toBe('Ramadan Mubarak Mega Sale');
    expect(updatedPublicRes.body.data.homepage.sections[0].order).toBe(1);
    expect(updatedPublicRes.body.data.homepage.sections[2].title).toBe('VIP Exclusive Club');
  });

  // TEST 4: Dynamic Functional Feature Flags (Real-Time Toggles)
  it('4. Dynamically toggles functional features at runtime without redeployment', async () => {
    // 1. Initial state: COD is enabled
    const initial = await request(app)
      .get('/api/v1/storefront/config')
      .set('x-tenant-id', tenantA._id);

    expect(initial.body.data.features.codEnabled).toBe(true);

    // 2. Merchant disables Cash on Delivery (e.g. during bank transfer promotion)
    const toggleCodRes = await request(app)
      .patch('/api/v1/storefront/theme/features/codEnabled')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ enabled: false });

    expect(toggleCodRes.status).toBe(200);
    expect(toggleCodRes.body.data.enabled).toBe(false);

    // 3. Merchant enables online payments & adds WhatsApp number
    await request(app)
      .put('/api/v1/storefront/theme')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        features: {
          onlinePaymentEnabled: true,
          whatsappNumber: '923001234567',
        },
      });

    // 4. Verify public storefront config instantly reflects new functional flags
    const toggledPublic = await request(app)
      .get('/api/v1/storefront/config')
      .set('x-tenant-id', tenantA._id);

    expect(toggledPublic.body.data.features.codEnabled).toBe(false);
    expect(toggledPublic.body.data.features.onlinePaymentEnabled).toBe(true);
    expect(toggledPublic.body.data.features.whatsappNumber).toBe('923001234567');
  });

  // TEST 5: Strict Multi-Tenant Theme Isolation
  it('5. Strictly isolates theme, design, and footer between Merchant A and Merchant B', async () => {
    // Merchant A sets custom gold theme
    await request(app)
      .put('/api/v1/storefront/theme')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        colors: { primary: '#d97706', footerBg: '#78350f' },
        footer: { copyright: '© 2026 Luxe Apparel' },
      });

    // Merchant B sets custom cyan theme
    await request(app)
      .put('/api/v1/storefront/theme')
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({
        colors: { primary: '#06b6d4', footerBg: '#083344' },
        footer: { copyright: '© 2026 Tech Haven' },
      });

    // Verify Merchant A config
    const configA = await request(app)
      .get('/api/v1/storefront/config')
      .set('x-tenant-id', tenantA._id);

    expect(configA.body.data.colors.primary).toBe('#d97706');
    expect(configA.body.data.footer.copyright).toBe('© 2026 Luxe Apparel');

    // Verify Merchant B config is completely independent
    const configB = await request(app)
      .get('/api/v1/storefront/config')
      .set('x-tenant-id', tenantB._id);

    expect(configB.body.data.colors.primary).toBe('#06b6d4');
    expect(configB.body.data.footer.copyright).toBe('© 2026 Tech Haven');
  });

  // TEST 6: Public Catalog, Cart Calculation & Online Checkout
  it('6. Allows public customers to browse catalog, calculate authoritative cart, and place online order', async () => {
    // 1. Merchant A creates 2 products
    const prod1Res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Embroidered Silk Kurta',
        sku: 'KUR-01',
        slug: 'embroidered-silk-kurta',
        pricing: { costPrice: 2000, retailPrice: 4500 },
        stock: 20,
      });

    const prodId1 = prod1Res.body.data._id;

    // 2. Customer browses catalog via public store slug
    const catalogRes = await request(app)
      .get(`/api/v1/storefront/${tenantA.slug}/catalog`);

    expect(catalogRes.status).toBe(200);
    expect(catalogRes.body.data.length).toBe(1);
    expect(catalogRes.body.data[0].name).toBe('Embroidered Silk Kurta');
    expect(catalogRes.body.data[0].pricing.retailPrice).toBe(4500);

    // 3. Customer views single product by slug
    const prodRes = await request(app)
      .get(`/api/v1/storefront/${tenantA.slug}/catalog/embroidered-silk-kurta`);

    expect(prodRes.status).toBe(200);
    expect(prodRes.body.data.sku).toBe('KUR-01');

    // 4. Customer requests authoritative cart quote (server calculates line totals)
    const quoteRes = await request(app)
      .post(`/api/v1/storefront/${tenantA.slug}/cart/quote`)
      .send({
        items: [{ productId: prodId1, quantity: 2 }],
      });

    expect(quoteRes.status).toBe(200);
    expect(quoteRes.body.data.financials.subtotal).toBe(9000); // 4500 * 2
    expect(quoteRes.body.data.financials.shippingFee).toBe(0); // Free delivery over Rs. 3,000
    expect(quoteRes.body.data.financials.grandTotal).toBe(9000);

    // 5. Customer places online order (COD)
    const orderRes = await request(app)
      .post(`/api/v1/storefront/${tenantA.slug}/orders`)
      .send({
        customer: {
          name: 'Ayesha Malik',
          phone: '03001239999',
          email: 'ayesha@example.com',
          shippingAddress: {
            street: 'House 12, Street 4',
            city: 'Islamabad',
          },
        },
        items: [{ productId: prodId1, quantity: 2 }],
        payment: { method: 'cod' },
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.data.orderNumber).toBeDefined();
    expect(orderRes.body.data.channel).toBe('online');
    expect(orderRes.body.data.financials.grandTotal).toBe(9000);

    const orderNumber = orderRes.body.data.orderNumber;

    // 6. Customer tracks their order publicly
    const trackRes = await request(app)
      .get(`/api/v1/storefront/${tenantA.slug}/orders/${orderNumber}/track`);

    expect(trackRes.status).toBe(200);
    expect(trackRes.body.data.orderNumber).toBe(orderNumber);
    expect(trackRes.body.data.fulfillmentStatus).toBe('pending');
    expect(trackRes.body.data.items[0].name).toBe('Embroidered Silk Kurta');
  });
});

