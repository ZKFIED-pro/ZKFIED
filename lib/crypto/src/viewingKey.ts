import * as nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { ViewingKeyPair, DerivedKey } from './types';

export class ViewingKeyManager {
  private static readonly SALT_LENGTH = 32;

  static generateKeyPair(): ViewingKeyPair {
    const keyPair = nacl.box.keyPair();

    return {
      publicKey: encodeBase64(keyPair.publicKey),
      privateKey: encodeBase64(keyPair.secretKey)
    };
  }

  static deriveKeyFromPassword(password: string, salt?: Uint8Array): DerivedKey {
    const actualSalt = salt || nacl.randomBytes(this.SALT_LENGTH);

    const iterations = 100000;
    let derivedKey = nacl.hash(new Uint8Array([...new TextEncoder().encode(password), ...actualSalt]));

    for (let i = 0; i < iterations; i++) {
      derivedKey = nacl.hash(derivedKey);
    }

    return {
      key: derivedKey.slice(0, nacl.secretbox.keyLength),
      salt: actualSalt
    };
  }

  static createViewingKeyFromSeed(seed: string): ViewingKeyPair {
    const hash = nacl.hash(new TextEncoder().encode(seed));
    const keyPair = nacl.box.keyPair.fromSecretKey(hash.slice(0, 32));

    return {
      publicKey: encodeBase64(keyPair.publicKey),
      privateKey: encodeBase64(keyPair.secretKey)
    };
  }

  static validatePublicKey(publicKey: string): boolean {
    try {
      const decoded = decodeBase64(publicKey);
      return decoded.length === nacl.box.publicKeyLength;
    } catch {
      return false;
    }
  }

  static validateKeyPair(keyPair: ViewingKeyPair): boolean {
    try {
      const publicKey = decodeBase64(keyPair.publicKey);
      const privateKey = decodeBase64(keyPair.privateKey);

      if (publicKey.length !== nacl.box.publicKeyLength) return false;
      if (privateKey.length !== nacl.box.secretKeyLength) return false;

      const testMessage = new Uint8Array(32);
      const nonce = nacl.randomBytes(nacl.box.nonceLength);

      const encrypted = nacl.box(testMessage, nonce, publicKey, privateKey);
      const decrypted = nacl.box.open(encrypted, nonce, publicKey, privateKey);

      return decrypted !== null;
    } catch {
      return false;
    }
  }

  static exportKeyPair(keyPair: ViewingKeyPair): string {
    return JSON.stringify(keyPair);
  }

  static importKeyPair(exported: string): ViewingKeyPair {
    const keyPair = JSON.parse(exported) as ViewingKeyPair;

    if (!this.validateKeyPair(keyPair)) {
      throw new Error('Invalid key pair');
    }

    return keyPair;
  }
}
