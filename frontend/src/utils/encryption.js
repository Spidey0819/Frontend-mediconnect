// End-to-end encryption utilities for MediConnect
// Uses AES-256-GCM encryption with Diffie-Hellman key exchange

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

// Diffie-Hellman parameters (RFC 3526 - 2048-bit MODP group)
const DH_PRIME = BigInt('0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183560DB10B3E5A4B2E1C24E9F')
const DH_GENERATOR = BigInt(2)

class EncryptionManager {
  constructor() {
    this.conversationKeys = new Map();
    this.dhKeyPairs = new Map(); // Store DH key pairs per conversation
  }

  // Generate DH key pair for a conversation
  async generateDHKeyPair(conversationId) {
    try {
      // Generate random private key (256 bits for security)
      const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const privateKey = this.bytesToBigInt(privateKeyBytes);
      
      // Calculate public key: g^private mod p
      const publicKey = this.modPow(DH_GENERATOR, privateKey, DH_PRIME);
      
      const keyPair = { privateKey, publicKey };
      this.dhKeyPairs.set(conversationId, keyPair);
      
      // Store in localStorage for persistence
      localStorage.setItem(`dh_keypair_${conversationId}`, JSON.stringify({
        privateKey: privateKey.toString(16),
        publicKey: publicKey.toString(16),
        version: 3 // Version 3 = DH keys
      }));
      
      return keyPair;
    } catch (error) {
      console.error('Failed to generate DH key pair:', error);
      throw new Error('DH key pair generation failed');
    }
  }

  // Load DH key pair from storage
  async loadDHKeyPair(conversationId) {
    try {
      // Check if key pair is already in memory
      if (this.dhKeyPairs.has(conversationId)) {
        return this.dhKeyPairs.get(conversationId);
      }

      // Try to load from localStorage
      const storedKeyPair = localStorage.getItem(`dh_keypair_${conversationId}`);
      if (storedKeyPair) {
        try {
          const keyData = JSON.parse(storedKeyPair);
          if (keyData.version === 3 && keyData.privateKey && keyData.publicKey) {
            const keyPair = {
              privateKey: BigInt('0x' + keyData.privateKey),
              publicKey: BigInt('0x' + keyData.publicKey)
            };
            this.dhKeyPairs.set(conversationId, keyPair);
            return keyPair;
          }
        } catch (parseError) {
          localStorage.removeItem(`dh_keypair_${conversationId}`);
        }
      }

      // No key pair exists, generate a new one
      return await this.generateDHKeyPair(conversationId);
    } catch (error) {
      console.error('Failed to load DH key pair:', error);
      throw new Error('DH key pair loading failed');
    }
  }

  // Calculate shared secret from other party's public key
  async calculateSharedSecret(conversationId, otherPublicKey) {
    try {
      const keyPair = await this.loadDHKeyPair(conversationId);
      const otherPublicKeyBigInt = typeof otherPublicKey === 'string' 
        ? BigInt('0x' + otherPublicKey) 
        : otherPublicKey;
      
      // Calculate shared secret: other_public^our_private mod p
      const sharedSecret = this.modPow(otherPublicKeyBigInt, keyPair.privateKey, DH_PRIME);
      
      // Derive AES key from shared secret using HKDF
      const sharedSecretBytes = this.bigIntToBytes(sharedSecret);
      const key = await this.deriveAESKey(sharedSecretBytes, conversationId);
      
      // Store the derived key
      this.conversationKeys.set(conversationId, key);
      
      // Store key info in localStorage for persistence
      const exportedKey = await crypto.subtle.exportKey('jwk', key);
      localStorage.setItem(`chat_key_${conversationId}`, JSON.stringify({
        ...exportedKey,
        version: 3, // Version 3 = DH-derived keys
        derivedFrom: 'dh'
      }));
      
      return key;
    } catch (error) {
      console.error('Failed to calculate shared secret:', error);
      throw new Error('Shared secret calculation failed');
    }
  }

  // Derive AES key from shared secret using HKDF
  async deriveAESKey(sharedSecretBytes, conversationId) {
    try {
      // Import shared secret as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        sharedSecretBytes,
        'HKDF',
        false,
        ['deriveKey']
      );

      // Use conversation ID as salt for HKDF
      const encoder = new TextEncoder();
      const salt = await crypto.subtle.digest('SHA-256', encoder.encode(conversationId));

      // Derive AES-GCM key
      const key = await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: salt,
          info: encoder.encode('MediConnect-E2EE-v3')
        },
        keyMaterial,
        {
          name: ALGORITHM,
          length: KEY_LENGTH
        },
        true,
        ['encrypt', 'decrypt']
      );

      return key;
    } catch (error) {
      console.error('Failed to derive AES key:', error);
      throw new Error('AES key derivation failed');
    }
  }

  // Utility: Convert bytes to BigInt
  bytesToBigInt(bytes) {
    let result = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
      result = (result << BigInt(8)) + BigInt(bytes[i]);
    }
    return result;
  }

  // Utility: Convert BigInt to bytes
  bigIntToBytes(bigint) {
    const hex = bigint.toString(16);
    const paddedHex = hex.length % 2 ? '0' + hex : hex;
    const bytes = new Uint8Array(paddedHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(paddedHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // Utility: Modular exponentiation (a^b mod m)
  modPow(base, exponent, modulus) {
    let result = BigInt(1);
    base = base % modulus;
    while (exponent > 0) {
      if (exponent % BigInt(2) === BigInt(1)) {
        result = (result * base) % modulus;
      }
      exponent = exponent >> BigInt(1);
      base = (base * base) % modulus;
    }
    return result;
  }

  // Get public key for sharing with other party
  async getPublicKey(conversationId) {
    try {
      const keyPair = await this.loadDHKeyPair(conversationId);
      return keyPair.publicKey.toString(16);
    } catch (error) {
      console.error('Failed to get public key:', error);
      throw new Error('Public key retrieval failed');
    }
  }

  // Generate conversation key (now uses DH if public key is available)
  async generateConversationKey(conversationId, otherPublicKey = null) {
    try {
      if (otherPublicKey) {
        // Use DH key exchange
        return await this.calculateSharedSecret(conversationId, otherPublicKey);
      } else {
        // Check if we have a stored DH-derived key
        const storedKey = localStorage.getItem(`chat_key_${conversationId}`);
        if (storedKey) {
          try {
            const keyData = JSON.parse(storedKey);
            if (keyData.version === 3 && keyData.derivedFrom === 'dh') {
              const key = await crypto.subtle.importKey(
                'jwk',
                keyData,
                { name: ALGORITHM, length: KEY_LENGTH },
                true,
                ['encrypt', 'decrypt']
              );
              this.conversationKeys.set(conversationId, key);
              return key;
            }
          } catch (error) {
            localStorage.removeItem(`chat_key_${conversationId}`);
          }
        }
        
        // Fallback to deterministic key for backward compatibility
        return await this.generateLegacyKey(conversationId);
      }
    } catch (error) {
      console.error('Failed to generate conversation key:', error);
      throw new Error('Encryption key generation failed');
    }
  }

  // Legacy deterministic key generation for backward compatibility
  async generateLegacyKey(conversationId) {
    try {
      const encoder = new TextEncoder();
      const conversationData = encoder.encode(conversationId + 'mediconnect-chat-key');
      const hashBuffer = await crypto.subtle.digest('SHA-256', conversationData);
      const keyMaterial = new Uint8Array(hashBuffer).slice(0, 32);
      
      const keyBase64 = btoa(String.fromCharCode(...keyMaterial))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      const jwkKey = {
        kty: 'oct',
        k: keyBase64,
        alg: 'A256GCM',
        use: 'enc',
        ext: true,
        version: 2 // Version 2 = legacy deterministic keys
      };
      
      const key = await crypto.subtle.importKey(
        'jwk',
        jwkKey,
        { name: ALGORITHM, length: KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
      );

      this.conversationKeys.set(conversationId, key);
      localStorage.setItem(`chat_key_${conversationId}`, JSON.stringify(jwkKey));
      
      return key;
    } catch (error) {
      console.error('Failed to generate legacy key:', error);
      throw new Error('Legacy key generation failed');
    }
  }

  // Load an existing conversation key from storage
  async loadConversationKey(conversationId) {
    try {
      // Check if key is already in memory
      if (this.conversationKeys.has(conversationId)) {
        return this.conversationKeys.get(conversationId);
      }

      // Try to load from localStorage
      const storedKey = localStorage.getItem(`chat_key_${conversationId}`);
      if (storedKey) {
        try {
          const keyData = JSON.parse(storedKey);
          
          // Support both DH-derived keys (version 3) and legacy keys (version 2)
          if (keyData.kty === 'oct' && (keyData.version === 2 || keyData.version === 3)) {
            const key = await crypto.subtle.importKey(
              'jwk',
              keyData,
              {
                name: ALGORITHM,
                length: KEY_LENGTH
              },
              true,
              ['encrypt', 'decrypt']
            );
            
            this.conversationKeys.set(conversationId, key);
            return key;
          } else {
            // Old or invalid key format, remove and regenerate
            localStorage.removeItem(`chat_key_${conversationId}`);
            return await this.generateConversationKey(conversationId);
          }
        } catch (keyError) {
          localStorage.removeItem(`chat_key_${conversationId}`);
          return await this.generateConversationKey(conversationId);
        }
      }

      // No key exists, generate a new one
      return await this.generateConversationKey(conversationId);
    } catch (error) {
      console.error('Failed to load conversation key:', error);
      throw new Error('Encryption key loading failed');
    }
  }


  // Complete key exchange with other party's public key
  async completeKeyExchange(conversationId, otherPublicKey) {
    try {
      const key = await this.calculateSharedSecret(conversationId, otherPublicKey);
      return key;
    } catch (error) {
      console.error('Failed to complete key exchange:', error);
      throw new Error('Key exchange completion failed');
    }
  }

  // Check if DH key exchange is available for a conversation
  isDHKeyExchangeAvailable(conversationId) {
    const storedKey = localStorage.getItem(`chat_key_${conversationId}`);
    if (storedKey) {
      try {
        const keyData = JSON.parse(storedKey);
        return keyData.version === 3 && keyData.derivedFrom === 'dh';
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  // Encrypt a message
  async encryptMessage(conversationId, plaintext) {
    try {
      if (typeof plaintext !== 'string') {
        throw new Error('Invalid message to encrypt');
      }

      // Handle empty strings
      if (plaintext === '') {
        return '';
      }

      const key = await this.loadConversationKey(conversationId);
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // Generate random IV for each message
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      const encrypted = await crypto.subtle.encrypt(
        {
          name: ALGORITHM,
          iv: iv
        },
        key,
        data
      );

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv, 0);
      result.set(new Uint8Array(encrypted), iv.length);

      // Return as base64 string for transmission
      return btoa(String.fromCharCode(...result));
    } catch (error) {
      console.error('Message encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  // Decrypt a message
  async decryptMessage(conversationId, encryptedData) {
    try {
      if (typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
      }

      // Handle empty strings
      if (encryptedData === '') {
        return '';
      }

      // Check if this looks like encrypted data (base64)
      // If it doesn't look encrypted, assume it's legacy plain text
      if (!this.isBase64(encryptedData)) {
        return encryptedData;
      }

      const key = await this.loadConversationKey(conversationId);
      
      // Decode from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      // Check minimum size (IV + some encrypted data)
      if (combined.length < IV_LENGTH + 1) {
        console.warn('Encrypted data too short, assuming legacy plain text');
        return encryptedData;
      }

      // Extract IV and encrypted data
      const iv = combined.slice(0, IV_LENGTH);
      const encrypted = combined.slice(IV_LENGTH);

      try {
        const decrypted = await crypto.subtle.decrypt(
          {
            name: ALGORITHM,
            iv: iv
          },
          key,
          encrypted
        );

        const decoder = new TextDecoder();
        const result = decoder.decode(decrypted);
        return result;
      } catch (decryptError) {
        console.warn('Message decryption failed:', decryptError.message);
        
        // If DH key failed, try legacy key as fallback
        const storedKey = localStorage.getItem(`chat_key_${conversationId}`);
        if (storedKey) {
          const keyData = JSON.parse(storedKey);
          if (keyData.version === 3 && keyData.derivedFrom === 'dh') {
            console.log('DH decryption failed, trying legacy key fallback...');
            try {
              const legacyKey = await this.generateLegacyKey(conversationId);
              const legacyDecrypted = await crypto.subtle.decrypt(
                {
                  name: ALGORITHM,
                  iv: iv
                },
                legacyKey,
                encrypted
              );
              const decoder = new TextDecoder();
              return decoder.decode(legacyDecrypted);
            } catch (legacyError) {
              console.warn('Legacy decryption also failed:', legacyError.message);
            }
          }
        }
        
        // If all decryption attempts fail, return original data for legacy compatibility
        throw decryptError;
      }
    } catch (error) {
      console.warn('Overall decryption failed, assuming legacy plain text:', error.message);
      // Return original data for legacy compatibility
      return encryptedData;
    }
  }

  // Helper method to check if a string is valid base64
  isBase64(str) {
    try {
      // Check if it's a valid base64 string
      if (str === '' || str.trim() === '') return false;
      
      // Base64 regex pattern - allow any length, padding will be handled by atob
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Pattern.test(str)) {
        return false;
      }
      
      // Try to decode
      atob(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Check if encryption is supported in this browser
  isEncryptionSupported() {
    return !!(window.crypto && window.crypto.subtle);
  }

  // Clean up keys when conversation is no longer needed
  clearConversationKey(conversationId) {
    this.conversationKeys.delete(conversationId);
    localStorage.removeItem(`chat_key_${conversationId}`);
  }

  // Get debug info about encryption status
  getEncryptionStatus() {
    return {
      supported: this.isEncryptionSupported(),
      activeConversations: this.conversationKeys.size,
      conversations: Array.from(this.conversationKeys.keys())
    };
  }
}

// Create a singleton instance
const encryptionManager = new EncryptionManager();

export default encryptionManager;

// Export specific methods for easier use
export const {
  encryptMessage,
  decryptMessage,
  generateConversationKey,
  loadConversationKey,
  isEncryptionSupported,
  clearConversationKey,
  getEncryptionStatus,
  completeKeyExchange,
  getPublicKey,
  isDHKeyExchangeAvailable
} = encryptionManager;