import { ICourierAdapter } from './ICourierAdapter.js';

export class PostExAdapter extends ICourierAdapter {
  constructor() {
    super('postex', 'PostEx Logistics');
    this.defaultBaseUrl = 'https://api.postex.pk/services/integration/api/order/v1/';
  }

  /**
   * Book an outbound shipment with PostEx
   */
  async bookShipment({ credentials, settings = {}, order, parcelInfo = {} }) {
    if (!credentials?.apiToken) {
      throw new Error('PostEx API token is required');
    }

    const isTestMode = settings.testMode === true || (settings.testMode == null && process.env.NODE_ENV === 'test');

    if (isTestMode) {
      const randDigits = Math.floor(100000000 + Math.random() * 900000000);
      const trackingNumber = `PEX-${randDigits}`;
      return {
        trackingNumber,
        bookingRef: `BOOK-PEX-${Date.now()}`,
        labelUrl: `https://api.postex.pk/order/print-label/${trackingNumber}`,
        raw: {
          statusCode: 200,
          status: 'success',
          distrCode: trackingNumber,
        },
      };
    }

    const baseUrl = settings.baseUrl || this.defaultBaseUrl;
    const url = `${baseUrl}create-order`;

    const payload = {
      cityName: order.customer.shippingAddress?.city || 'Lahore',
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      deliveryAddress: order.customer.shippingAddress?.street || 'Address',
      invoiceAmount: order.payment.status === 'paid' ? 0 : order.financials.outstandingBalance,
      orderDetail: parcelInfo.remarks || `Order #${order.orderNumber}`,
      orderRefNumber: order.orderNumber,
      orderType: 'Normal',
      pickupAddressCode: settings.pickupAddressCode || '001',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: credentials.apiToken,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    if (data.statusCode !== '200' && data.statusCode !== 200) {
      throw new Error(`PostEx Booking Error: ${data.statusMessage || 'Failed to book order with PostEx'}`);
    }

    const trackingNumber = String(data.distrCode);
    return {
      trackingNumber,
      bookingRef: trackingNumber,
      labelUrl: `https://api.postex.pk/order/print-label/${trackingNumber}`,
      raw: data,
    };
  }

  /**
   * Track PostEx parcel
   */
  async trackShipment({ credentials, trackingNumber, settings = {} }) {
    const isTestMode = settings.testMode === true || (settings.testMode == null && process.env.NODE_ENV === 'test');
    if (isTestMode) {
      return {
        trackingNumber,
        status: 'in_transit',
        location: 'Lahore Processing Center',
        history: [{ status: 'Received at Station', timestamp: new Date() }],
        raw: { test: true },
      };
    }

    const baseUrl = settings.baseUrl || this.defaultBaseUrl;
    const url = `${baseUrl}track-order/${trackingNumber}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { token: credentials.apiToken },
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    const rawStatus = String(data?.distrStatus || '').toLowerCase();
    let normalizedStatus = 'in_transit';
    if (rawStatus.includes('delivered')) normalizedStatus = 'delivered';
    else if (rawStatus.includes('return')) normalizedStatus = 'returned';

    return {
      trackingNumber,
      status: normalizedStatus,
      location: data?.cityName || '',
      history: data?.trackingHistory || [],
      raw: data,
    };
  }

  /**
   * Normalize PostEx webhook
   */
  async verifyWebhook({ payload }) {
    const trackingNumber = payload.trackingNumber || payload.distrCode;
    if (!trackingNumber) {
      return { isValid: false, message: 'Missing tracking number in PostEx webhook' };
    }

    const rawStatus = String(payload.orderStatus || payload.status || '').toLowerCase();
    let status = 'in_transit';
    if (rawStatus.includes('delivered')) status = 'delivered';
    else if (rawStatus.includes('return')) status = 'returned';

    return {
      isValid: true,
      trackingNumber: String(trackingNumber).trim(),
      status,
      raw: payload,
    };
  }
}

export default PostExAdapter;
