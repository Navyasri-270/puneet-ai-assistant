import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getCandidateKeys(): Buffer[] {
  const secrets = [
    process.env.ENCRYPTION_SECRET,
    process.env.CRON_SECRET,
    'puneet-ai-assistant-fallback-secret-2026',
    'mys3b851060d6bf93d175af5a6cc464c9ef2a69bdfb472a27bdab053dc43869017aecret',
  ].filter(Boolean) as string[];

  const uniqueSecrets = Array.from(new Set(secrets));
  return uniqueSecrets.map((sec) => crypto.createHash('sha256').update(sec).digest());
}

/**
 * Encrypts sensitive string (e.g. OAuth access or refresh tokens) using AES-256-GCM.
 */
export function encryptToken(text: string | null | undefined): string | null {
  if (!text) return null;
  // If already encrypted format (contains colons), skip double-encrypting
  if (text.startsWith('enc:v1:')) return text;

  try {
    const secret = process.env.ENCRYPTION_SECRET || process.env.CRON_SECRET || 'puneet-ai-assistant-fallback-secret-2026';
    const key = crypto.createHash('sha256').update(secret).digest();
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
 * Decrypts AES-256-GCM encrypted token string trying candidate keys.
 */
export function decryptToken(cipherText: string | null | undefined): string | null {
  if (!cipherText) return null;
  if (!cipherText.startsWith('enc:v1:')) return cipherText; // Return unencrypted string as-is for backward compatibility

  const parts = cipherText.split(':');
  if (parts.length !== 5) return cipherText;

  const ivHex = parts[2];
  const authTagHex = parts[3];
  const encryptedHex = parts[4];
  const keys = getCandidateKeys();

  for (const key of keys) {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      if (decrypted) return decrypted;
    } catch (e) {
      // Try next key
    }
  }

  console.error('[Encryption] Token decryption failed with all candidate keys.');
  return null;
}
