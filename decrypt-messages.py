#!/usr/bin/env python3
"""
Standalone decryption utility for FTJM Chat messages

Requirements:
  pip install pycryptodome

Usage:
  python3 decrypt-messages.py "gc:U2FsdGVkX18..."
  python3 decrypt-messages.py (interactive mode)
"""

import sys
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

SECRET_KEY = 'your-secret-encryption-key-at-least-32-chars'
GC_PREFIX = 'gc:'


def evp_bytes_to_key(password: str, salt: bytes, key_len: int, iv_len: int) -> tuple:
    """
    Derive key and IV using OpenSSL's EVP_BytesToKey
    Compatible with CryptoJS AES encryption
    """
    m = []
    i = 0
    while len(b''.join(m)) < (key_len + iv_len):
        md5 = hashlib.md5()
        data = password.encode() if i == 0 else m[i - 1] + password.encode()
        md5.update(data + salt)
        m.append(md5.digest())
        i += 1
    ms = b''.join(m)
    return ms[:key_len], ms[key_len : key_len + iv_len]


def decrypt_text(ciphertext: str) -> str | None:
    """Decrypt CryptoJS AES encrypted text"""
    if not ciphertext:
        return ciphertext

    try:
        # Remove prefix
        payload = (
            ciphertext[len(GC_PREFIX) :]
            if ciphertext.startswith(GC_PREFIX)
            else ciphertext
        )

        # Decode base64
        import base64

        encrypted_bytes = base64.b64decode(payload)

        # Extract salt (after "Salted__" magic bytes)
        if not encrypted_bytes.startswith(b"Salted__"):
            raise ValueError("Invalid encrypted format: missing Salted__ header")

        salt = encrypted_bytes[8:16]
        encrypted = encrypted_bytes[16:]

        # Derive key and IV
        key, iv = evp_bytes_to_key(SECRET_KEY, salt, 32, 16)

        # Decrypt using AES-256-CBC
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(encrypted)

        # Remove PKCS#7 padding
        unpadded = unpad(decrypted, AES.block_size)

        return unpadded.decode("utf-8")

    except Exception as e:
        print(f"❌ Decryption failed: {e}")
        return None


def interactive_mode():
    """Interactive decryption mode"""
    print("🔐 FTJM Chat Message Decryption Utility")
    print("======================================")
    print('Paste encrypted messages (starting with "gc:") one per line.')
    print('Type "quit" or "exit" to stop.\n')

    while True:
        try:
            user_input = input("Enter encrypted message (or 'quit'): ").strip()

            if not user_input or user_input.lower() in ("quit", "exit"):
                print("Goodbye! 👋")
                break

            decrypted = decrypt_text(user_input)
            if decrypted:
                print(f'✅ Decrypted: "{decrypted}"\n')
            else:
                print("⚠️  Could not decrypt message\n")

        except KeyboardInterrupt:
            print("\nGoodbye! 👋")
            break


def main():
    if len(sys.argv) > 1:
        # Command line mode
        encrypted = " ".join(sys.argv[1:])
        print(f"🔐 Decrypting: {encrypted[:50]}...")

        decrypted = decrypt_text(encrypted)
        if decrypted:
            print(f'✅ Result: "{decrypted}"')
            sys.exit(0)
        else:
            sys.exit(1)
    else:
        # Interactive mode
        interactive_mode()


if __name__ == "__main__":
    main()
