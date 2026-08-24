// utils/passwordLeak.ts
// Checks if a password appears in known data breaches using the HaveIBeenPwned Pwned Passwords API.
// Returns true if the password is found in the breach database.

import * as Crypto from 'expo-crypto';

/**
 * Determines whether the provided password has been leaked.
 * Uses k-anonymity via the first 5 SHA‑1 hash characters.
 */
export async function isPasswordLeaked(password: string): Promise<boolean> {
  if (!password) return false;
  // Compute SHA‑1 hash of the password
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, password);
  const prefix = hash.slice(0, 5).toUpperCase();
  const suffix = hash.slice(5).toUpperCase();
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) return false;
    const body = await response.text();
    // Each line: suffix:count
    const lines = body.split('\n');
    for (const line of lines) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix) {
        // Require at least 100 occurrences to avoid false positives for randomly generated passwords
        if (parseInt(count, 10) >= 100) {
          return true;
        }
      }
    }
    return false;
  } catch (_) {
    // On network error assume not leaked to avoid blocking signup
    return false;
  }
}
