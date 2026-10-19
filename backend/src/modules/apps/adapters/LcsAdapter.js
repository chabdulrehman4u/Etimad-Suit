import { ICourierAdapter } from './ICourierAdapter.js';

export class LcsAdapter extends ICourierAdapter {
  constructor() {
    super('lcs', 'Leopards Courier Service');
    this.defaultBaseUrl = 'https://merchantapi.leopardscourier.com/api/';
  }

  /**
   * Book an outbound packet with Leopards
   */
  async bookShipment({ credentials, settings = {}, order, parcelInfo = {} }) {
    if (!credentials?.apiKey || !credentials?.apiPassword) {
      throw new Error('Leopards API key and API password are required');
    }

    const isTestMode = settings.testMode === true || (settings.testMode == null && process.env.NODE_ENV === 'test');

    if (isTestMode) {
      const randDigits = Math.floor(100000 + Math.random() * 900000);
      const trackingNumber = `LCS-${randDigits}`;
      return {
        trackingNumber,
        bookingRef: `BOOK-LCS-${Date.now()}`,
        labelUrl: `https://merchant.leopardscourier.com/print-slip/${trackingNumber}`,
        raw: {
          status: 1,
          error: 0,
          message: 'Packet Booked Successfully (Test Mode)',
          track_number: trackingNumber,
        },
      };
    }

    // Live Leopards API HTTP Call
    const baseUrl = settings.baseUrl || this.defaultBaseUrl;
    const url = `${baseUrl}bookPacket/format/json/`;

    const payload = {
      api_key: credentials.apiKey,
      api_password: credentials.apiPassword,
      booked_packet_weight: Number(parcelInfo.weightGrams || 500),
      booked_packet_vol_weight_w: 0,
      booked_packet_vol_weight_h: 0,
      booked_packet_vol_weight_l: 0,
      booked_packet_no_piece: Number(parcelInfo.pieces || 1),
      booked_packet_collect_cash: order.payment.status === 'paid' ? 0 : order.financials.outstandingBalance,
      origin_city: settings.defaultOriginCityId || '36', // 36 = Karachi default in LCS
      destination_city: parcelInfo.destinationCityId || '36',
      shipment_name_eng: order.customer.name,
      shipment_email: order.customer.email || 'customer@store.com',
      shipment_phone: order.customer.phone,
      shipment_address: order.customer.shippingAddress?.street || 'Customer Address',
      booked_packet_comments: parcelInfo.remarks || `Order #${order.orderNumber}`,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();

    if (data.status === 0 || data.error === 1) {
      throw new Error(`Leopards Booking Error: ${data.message || data.error_message || 'Unknown provider error'}`);
    }

    const trackingNumber = String(data.track_number);
    return {
      trackingNumber,
      bookingRef: String(data.slip_id || `LCS-${Date.now()}`),
      labelUrl: `https://merchant.leopardscourier.com/print-slip/${trackingNumber}`,
      raw: data,
    };
  }

  /**
   * Track packet status
   */
  async trackShipment({ credentials, trackingNumber, settings = {} }) {
    const isTestMode = settings.testMode === true || (settings.testMode == null && process.env.NODE_ENV === 'test');
    if (isTestMode) {
      return {
        trackingNumber,
        status: 'in_transit',
        location: 'Karachi Hub',
        history: [
          { status: 'Booked', timestamp: new Date(Date.now() - 3600000), location: 'Karachi Central' },
          { status: 'In Transit', timestamp: new Date(), location: 'Karachi Hub' },
        ],
        raw: { test: true },
      };
    }

    const baseUrl = settings.baseUrl || this.defaultBaseUrl;
    const url = `${baseUrl}trackBookedPacket/format/json/`;

    const payload = {
      api_key: credentials.apiKey,
      api_password: credentials.apiPassword,
      track_numbers: trackingNumber,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();

    const rawStatus = String(data?.packet_list?.[0]?.status || 'booked').toLowerCase();
    let normalizedStatus = 'in_transit';
    if (rawStatus.includes('deliver')) normalizedStatus = 'delivered';
    else if (rawStatus.includes('return')) normalizedStatus = 'returned';

    return {
      trackingNumber,
      status: normalizedStatus,
      location: data?.packet_list?.[0]?.current_location || '',
      history: data?.packet_list?.[0]?.tracking_history || [],
      raw: data,
    };
  }

  /**
   * Normalize Leopards webhook callback
   */
  async verifyWebhook({ payload }) {
    const trackingNumber = payload.track_number || payload.tracking_number;
    if (!trackingNumber) {
      return { isValid: false, message: 'Missing tracking number in webhook' };
    }

    const rawStatus = String(payload.status || payload.event || '').toLowerCase();
    let status = 'in_transit';
    if (rawStatus.includes('delivered')) status = 'delivered';
    else if (rawStatus.includes('return')) status = 'returned';
    else if (rawStatus.includes('dispatch') || rawStatus.includes('booked')) status = 'dispatched';

    return {
      isValid: true,
      trackingNumber: String(trackingNumber).trim(),
      status,
      raw: payload,
    };
  }
}

export default LcsAdapter;
