# 🔐 AES Decryptie Handleiding

Deze handleiding beschrijft hoe je berichten die zijn opgeslagen in de database kunt ontcijferen.

## Technische Details

- **Algoritme**: AES (Advanced Encryption Standard)
- **Geheime Sleutel**: `your-secret-encryption-key-at-least-32-chars`
- **Database Prefix**: `gc:` (3 eerste tekens van versleutelde berichten)

## Berichten Identificeren

Versleutelde berichten worden opgeslagen met de prefix `gc:` gevolgd door de versleutelde inhoud.

### Voorbeeld:
```
gc:U2FsdGVkX18VERPqX7...
```

## Decryptie Methodes

### 1. Via Node.js (Terminal)

```javascript
// decrypt.js
const CryptoJS = require('crypto-js');

const SECRET_KEY = 'your-secret-encryption-key-at-least-32-chars';
const GC_PREFIX = 'gc:';

function decryptText(ciphertext) {
  if (!ciphertext) return ciphertext;

  const payload = ciphertext.startsWith(GC_PREFIX)
    ? ciphertext.slice(GC_PREFIX.length)
    : ciphertext;

  try {
    const bytes = CryptoJS.AES.decrypt(payload, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || ciphertext;
  } catch (error) {
    console.error('Failed to decrypt:', error);
    return ciphertext;
  }
}

// Test
const encrypted = process.argv[2] || 'gc:U2FsdGVkX18VERPqX7...';
console.log('Encrypted:', encrypted);
console.log('Decrypted:', decryptText(encrypted));
```

**Gebruik**:
```bash
npm install crypto-js
node decrypt.js "gc:U2FsdGVkX18..."
```

### 2. Via Browser Console

Voer dit in de browser DevTools console in:

```javascript
const SECRET_KEY = 'your-secret-encryption-key-at-least-32-chars';
const GC_PREFIX = 'gc:';

// Decrypt functie
function decrypt(ciphertext) {
  const payload = ciphertext.startsWith(GC_PREFIX)
    ? ciphertext.slice(GC_PREFIX.length)
    : ciphertext;
  
  try {
    const bytes = CryptoJS.AES.decrypt(payload, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return 'Failed to decrypt: ' + e.message;
  }
}

// Test met een bericht uit je database
decrypt('gc:U2FsdGVkX18...');
```

### 3. Via Python

```python
from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
import base64
import json

SECRET_KEY = 'your-secret-encryption-key-at-least-32-chars'
GC_PREFIX = 'gc:'

def decrypt_text(ciphertext):
    if not ciphertext:
        return ciphertext
    
    # Remove prefix if present
    payload = ciphertext[len(GC_PREFIX):] if ciphertext.startswith(GC_PREFIX) else ciphertext
    
    try:
        # Decode base64
        encrypted_bytes = base64.b64decode(payload)
        
        # Extract salt (first 8 bytes after "Salted__")
        if encrypted_bytes.startswith(b'Salted__'):
            salt = encrypted_bytes[8:16]
            encrypted_data = encrypted_bytes[16:]
        else:
            return ciphertext
        
        # Derive key and IV using OpenSSL EVP_BytesToKey equivalent
        key_iv = PBKDF2(SECRET_KEY.encode(), salt, dkLen=32+16, count=1, hmac_hash_module=__import__('hashlib').sha1)
        key = key_iv[:32]
        iv = key_iv[32:48]
        
        # Decrypt
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(encrypted_data)
        
        # Remove padding
        padding_length = decrypted[-1]
        return decrypted[:-padding_length].decode('utf-8')
    except Exception as e:
        print(f"Decryption failed: {e}")
        return ciphertext

# Test
encrypted = "gc:U2FsdGVkX18..."
print(f"Decrypted: {decrypt_text(encrypted)}")
```

### 4. Via In-App Chat UI (Aanbevolen)

De chat applicatie decrypteert automatisch berichten wanneer ze worden weergegeven. Je hoeft niets handmatig te doen!

- **DM Berichten**: Versleuteld verzonden en automatisch ontcijferd bij ontvangst
- **Algemene Chat Posts**: Versleuteld opgeslagen en ontcijferd bij weergave

## Database Query Voorbeeld

Om alle versleutelde berichten te zien in Supabase SQL Editor:

```sql
-- Alle versleutelde berichten in een conversatie
SELECT 
  id,
  conversation_id,
  sender_id,
  text,  -- Dit begint met 'gc:'
  is_encrypted,
  created_at
FROM messages
WHERE is_encrypted = true
  AND conversation_id = 'YOUR_CONVERSATION_ID'
ORDER BY created_at DESC;

-- Alle versleutelde posts in general chat
SELECT 
  id,
  author_id,
  content,  -- Dit begint met 'gc:'
  created_at
FROM posts
WHERE content LIKE 'gc:%'
ORDER BY created_at DESC;
```

## Veiligheidsnotities

⚠️ **Belangrijk**:
- De sleutel `your-secret-encryption-key-at-least-32-chars` is **ENKEL VOOR DEVELOPMENT**
- In productie: gebruik environment variables en secure key management
- Deel de sleutel **NOOIT** openbaar of in versiebeheer
- Deze encryptie is client-side; server-side encryptie wordt aanbevolen voor extra veiligheid

## Troubleshooting

### "Failed to decrypt" fout?
- Controleer of de ciphertext correct is gekopieerd (inclusief `gc:` prefix)
- Zorg dat je de juiste sleutel gebruikt
- Controleer of het bericht werkelijk versleuteld is

### Berichten vertonen niet correct?
- Zorg dat `is_encrypted` = `true` in de database
- Controleer browser console op errors
- Clear cache en reload de pagina

## Meer Informatie

- [CryptoJS Documentatie](https://cryptojs.gitbook.io/docs)
- [Supabase RLS Policies](./SUPABASE_SCHEMA.md)
- [App Architecture](./DEV_GUIDE.md)
