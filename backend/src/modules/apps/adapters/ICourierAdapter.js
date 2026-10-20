/**
 * Standard Interface Contract for all Courier Integrations in Etimad Suit SaaS
 */
export class ICourierAdapter {
  constructor(providerId, providerName) {
    this.providerId = providerId;
    this.providerName = providerName;
  }

  /**
   * Book an outbound courier shipment
   * @param {Object} params
   * @param {Object} params.credentials - Decrypted merchant API credentials
   * @param {Object} params.settings - Merchant integration settings
   * @param {Object} params.order - Canonical Order document
   * @param {Object} params.parcelInfo - { weightKg, pieces, remarks }
   * @returns {Promise<{ trackingNumber: string, bookingRef: string, labelUrl?: string, raw: any }>}
   */
  async bookShipment(params) {
    throw new Error('Method bookShipment() must be implemented by courier adapter');
  }

  /**
   * Query live tracking status
   * @param {Object} params
   * @param {string} params.trackingNumber
   * @param {Object} params.credentials
   * @returns {Promise<{ trackingNumber: string, status: string, location?: string, history: Array, raw: any }>}
   */
  async trackShipment(params) {
    throw new Error('Method trackShipment() must be implemented by courier adapter');
  }

  /**
   * Cancel a booked shipment
   * @param {Object} params
   * @param {string} params.trackingNumber
   * @param {Object} params.credentials
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async cancelShipment(params) {
    throw new Error('Method cancelShipment() must be implemented by courier adapter');
  }

  /**
   * Normalize and verify incoming webhook callback
   * @param {Object} params
   * @param {Object} params.payload
   * @param {Object} params.headers
   * @param {Object} params.credentials
   * @returns {Promise<{ isValid: boolean, trackingNumber: string, status: string, raw: any }>}
   */
  async verifyWebhook(params) {
    throw new Error('Method verifyWebhook() must be implemented by courier adapter');
  }
}

export default ICourierAdapter;

