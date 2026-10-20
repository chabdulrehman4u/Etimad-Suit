import crypto from 'crypto';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

function getKey(keyOverride) {
  const secret = keyOverride || config.dataEncryptionKey;
  // Deterministically hash to ensure exactly 32 bytes (256 bits)
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM authenticated encryption
 * Format: ivHex:authTagHex:encryptedHex
 */
export const encrypt = (text, keyOverride) => {
  if (text == null) return '';
  const stringValue = typeof text === 'object' ? JSON.stringify(text) : String(text);

  const key = getKey(keyOverride);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(stringValue, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt AES-256-GCM ciphertext string with authentication check
 */
export const decrypt = (encryptedString, keyOverride) => {
  if (!encryptedString || typeof encryptedString !== 'string') return null;

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey(keyOverride);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
};

/**
 * Mask secret string for safe API exposure (e.g. "sk_live_123456789" -> "sk_l****6789")
 */
export const maskSecret = (secret) => {
  if (!secret) return '';
  const str = String(secret);
  if (str.length <= 8) return '****';
  const prefix = str.substring(0, 4);
  const suffix = str.substring(str.length - 4);
  return `${prefix}****${suffix}`;
};

