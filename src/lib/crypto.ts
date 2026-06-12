import crypto from 'crypto';

/**
 * Derives a 32-byte key from ENCRYPTION_SECRET_KEY using sha256 to ensure Key size correctness.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET_KEY;
  if (!secret) {
    console.warn('ENCRYPTION_SECRET_KEY environment variable is missing. Using a fallback temporary key.');
    // Fallback key for standard build environments when secrets are not yet injected
    return crypto.createHash('sha256').update('DEFAULT_FALLBACK_TEMP_SECRET_KEY').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string using aes-256-gcm.
 * Output format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard IV size for GCM is 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts an aes-256-gcm encrypted string.
 * Input format: iv:authTag:ciphertext
 */
export function decrypt(ciphertextWithMetadata: string): string {
  if (!ciphertextWithMetadata) return '';
  const key = getEncryptionKey();
  const parts = ciphertextWithMetadata.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
