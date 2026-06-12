#!/usr/bin/env node

/**
 * Standalone decryption utility for FTJM Chat messages
 * 
 * Usage:
 *   node decrypt-messages.js "gc:U2FsdGVkX18..."
 *   node decrypt-messages.js (interactive mode)
 */

import crypto from 'crypto';
import readline from 'readline';

const SECRET_KEY = 'app-chat-secret-key-2024';
const GC_PREFIX = 'gc:';

/**
 * Decrypt CryptoJS AES encrypted text
 * Supports OpenSSL EVP_BytesToKey format (default for CryptoJS)
 */
function decryptText(ciphertext) {
  if (!ciphertext) return ciphertext;

  try {
    // Remove prefix
    const payload = ciphertext.startsWith(GC_PREFIX)
      ? ciphertext.slice(GC_PREFIX.length)
      : ciphertext;

    // Decode base64
    const encryptedBytes = Buffer.from(payload, 'base64');

    // Extract salt (after "Salted__" magic bytes)
    if (!encryptedBytes.toString('utf8', 0, 8).startsWith('Salted__')) {
      throw new Error('Invalid encrypted format: missing Salted__ header');
    }

    const salt = encryptedBytes.slice(8, 16);
    const encrypted = encryptedBytes.slice(16);

    // Derive key and IV using OpenSSL EVP_BytesToKey
    // CryptoJS uses: MD5(password + salt) repeatedly to derive key + iv
    const md5 = crypto.createHash('md5');
    md5.update(SECRET_KEY + salt.toString('binary'));
    const m_i = md5.digest();

    const md5_2 = crypto.createHash('md5');
    md5_2.update(m_i + SECRET_KEY + salt.toString('binary'));
    const m_ii = md5_2.digest();

    const key = Buffer.concat([m_i, m_ii]);
    const iv = key.slice(32, 48);

    // Decrypt using AES-256-CBC
    const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // Remove PKCS#7 padding
    const paddingLength = decrypted[decrypted.length - 1];
    const unpadded = decrypted.slice(0, decrypted.length - paddingLength);

    return unpadded.toString('utf8');
  } catch (error) {
    console.error(`❌ Decryption failed: ${error.message}`);
    return null;
  }
}

/**
 * Interactive mode
 */
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('🔐 FTJM Chat Message Decryption Utility');
  console.log('======================================');
  console.log('Paste encrypted messages (starting with "gc:") one per line.');
  console.log('Type "quit" or "exit" to stop.\n');

  const askForInput = () => {
    rl.question('Enter encrypted message (or "quit"): ', (input) => {
      if (!input || input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
        console.log('Goodbye! 👋');
        rl.close();
        return;
      }

      const decrypted = decryptText(input);
      if (decrypted) {
        console.log(`✅ Decrypted: "${decrypted}"\n`);
      } else {
        console.log('⚠️  Could not decrypt message\n');
      }

      askForInput();
    });
  };

  askForInput();
}

/**
 * Main
 */
if (process.argv.length > 2) {
  // Command line mode
  const encrypted = process.argv.slice(2).join(' ');
  console.log(`🔐 Decrypting: ${encrypted.substring(0, 50)}...`);

  const decrypted = decryptText(encrypted);
  if (decrypted) {
    console.log(`✅ Result: "${decrypted}"`);
    process.exit(0);
  } else {
    process.exit(1);
  }
} else {
  // Interactive mode
  interactiveMode();
}
