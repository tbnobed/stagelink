import { randomBytes } from 'crypto';

/**
 * Generate a random short code for URL shortening
 * Uses alphanumeric characters (excluding similar looking ones)
 */
export function generateShortCode(length: number = 6): string {
  // Characters excluding 0, O, I, l to avoid confusion
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes(1)[0] % chars.length;
    result += chars[randomIndex];
  }
  
  return result;
}

/**
 * Generate a unique short code that doesn't exist in the database
 */
export async function generateUniqueShortCode(
  checkExists: (code: string) => Promise<boolean>,
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateShortCode();
    if (!(await checkExists(code))) {
      return code;
    }
  }
  
  // If we couldn't generate a unique code, try with longer length
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateShortCode(8);
    if (!(await checkExists(code))) {
      return code;
    }
  }
  
  throw new Error('Unable to generate unique short code');
}