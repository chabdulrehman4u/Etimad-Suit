import { LcsAdapter } from './LcsAdapter.js';
import { PostExAdapter } from './PostExAdapter.js';

const adapters = {
  lcs: new LcsAdapter(),
  postex: new PostExAdapter(),
};

/**
 * Resolve courier adapter by providerId ('lcs', 'postex', etc.)
 */
export const getCourierAdapter = (providerId) => {
  const cleanId = String(providerId).toLowerCase().trim();
  const adapter = adapters[cleanId];
  if (!adapter) {
    throw new Error(`Unsupported courier provider: "${providerId}". Supported: [${Object.keys(adapters).join(', ')}]`);
  }
  return adapter;
};

export const listSupportedCouriers = () => {
  return Object.values(adapters).map((a) => ({
    providerId: a.providerId,
    providerName: a.providerName,
  }));
};

export default { getCourierAdapter, listSupportedCouriers };

