/**
 * Shared Validation Rules & Sanity Checkers for Etimad Suit SaaS
 */

/**
 * Validates and normalizes Pakistani mobile numbers (e.g., 03001234567 or +923001234567)
 */
export const validatePakistaniPhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, normalized: '', message: 'Phone number is required' };
  }

  const digits = phone.replace(/\D/g, '');

  // Format 03XXXXXXXXX (11 digits)
  if (digits.length === 11 && digits.startsWith('03')) {
    return { isValid: true, normalized: digits, formatted: `${digits.slice(0, 4)}-${digits.slice(4)}` };
  }

  // Format 923XXXXXXXXX (12 digits)
  if (digits.length === 12 && digits.startsWith('923')) {
    const local = `0${digits.slice(2)}`;
    return { isValid: true, normalized: local, formatted: `${local.slice(0, 4)}-${local.slice(4)}` };
  }

  return {
    isValid: false,
    normalized: digits,
    message: 'Invalid Pakistani mobile number. Must start with 03 or +923 and be 11 digits.',
  };
};

/**
 * Normalizes email address
 */
export const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

/**
 * Validates and sanitizes tenant slugs (e.g. "luxe-apparel")
 */
export const sanitizeTenantSlug = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Validates custom domain format (e.g., "shop.mybrand.pk" or "mybrand.com")
 */
export const validateDomain = (domain) => {
  if (!domain || typeof domain !== 'string') {
    return { isValid: false, message: 'Domain is required' };
  }

  const clean = domain.trim().toLowerCase();
  const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;

  if (!domainRegex.test(clean)) {
    return { isValid: false, message: 'Invalid domain format. Example: store.mybrand.com' };
  }

  // Prevent connecting internal platform hostnames
  const restricted = ['etimadsuit.com', 'localhost', '127.0.0.1'];
  if (restricted.some((r) => clean.includes(r))) {
    return { isValid: false, message: 'Cannot register a reserved platform domain' };
  }

  return { isValid: true, domain: clean };
};

/**
 * Validates order checkout payload
 */
export const validateCheckoutPayload = (payload) => {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Request body must be an object'] };
  }

  if (!payload.customer || typeof payload.customer !== 'object') {
    errors.push('Customer contact information is required');
  } else {
    if (!payload.customer.name || !String(payload.customer.name).trim()) {
      errors.push('Customer full name is required');
    }
    const phoneCheck = validatePakistaniPhone(payload.customer.phone);
    if (!phoneCheck.isValid) {
      errors.push(phoneCheck.message);
    }
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push('Order must contain at least one product item');
  } else {
    payload.items.forEach((item, index) => {
      if (!item.productId && !item._id) errors.push(`Item ${index + 1} is missing productId`);
      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) errors.push(`Item ${index + 1} has invalid quantity`);
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

