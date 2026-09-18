import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || process.env.CRON_SECRET || 'puneet-ai-assistant-fallback-secret-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive string (e.g. OAuth access or refresh tokens) using AES-256-GCM.
 */
export function encryptToken(text: string | null | undefined): string | null {
  if (!text) return null;
  // If already encrypted format (contains colons), skip double-encrypting
  if (text.startsWith('enc:v1:')) return text;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Encryption] Token encryption failed:', err);
    return text; // Fallback to raw string if encryption fails
  }
}

/**
 * Decrypts AES-256-GCM encrypted token string.
 */
export function decryptToken(cipherText: string | null | undefined): string | null {
  if (!cipherText) return null;
  if (!cipherText.startsWith('enc:v1:')) return cipherText; // Return unencrypted string as-is for backward compatibility

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 5) return cipherText;

    const ivHex = parts[2];
    const authTagHex = parts[3];
    const encryptedHex = parts[4];

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[Encryption] Token decryption failed:', err);
    return null;
  }
}
