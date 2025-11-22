import * as nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { EncryptedData, ViewingKeyPair, EncryptedEvidence } from './types';

export class EvidenceEncryption {
  static generateViewingKeyPair(): ViewingKeyPair {
    const keyPair = nacl.box.keyPair();

    return {
      publicKey: encodeBase64(keyPair.publicKey),
      privateKey: encodeBase64(keyPair.secretKey)
    };
  }

  static encryptForViewingKey(
    data: string | Uint8Array,
    recipientPublicKey: string
  ): EncryptedData {
    const message = typeof data === 'string' ? encodeUTF8(data) : data;
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ephemeralKeyPair = nacl.box.keyPair();

    const ciphertext = nacl.box(
      message,
      nonce,
      decodeBase64(recipientPublicKey),
      ephemeralKeyPair.secretKey
    );

    return {
      ciphertext: encodeBase64(ciphertext),
      nonce: encodeBase64(nonce),
      ephemeralPublicKey: encodeBase64(ephemeralKeyPair.publicKey)
    };
  }

  static decryptWithViewingKey(
    encrypted: EncryptedData,
    privateKey: string
  ): Uint8Array {
    if (!encrypted.ephemeralPublicKey) {
      throw new Error('Missing ephemeral public key');
    }

    const message = nacl.box.open(
      decodeBase64(encrypted.ciphertext),
      decodeBase64(encrypted.nonce),
      decodeBase64(encrypted.ephemeralPublicKey),
      decodeBase64(privateKey)
    );

    if (!message) {
      throw new Error('Decryption failed');
    }

    return message;
  }

  static encryptSymmetric(data: string | Uint8Array, key: Uint8Array): EncryptedData {
    const message = typeof data === 'string' ? encodeUTF8(data) : data;
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

    const ciphertext = nacl.secretbox(message, nonce, key);

    return {
      ciphertext: encodeBase64(ciphertext),
      nonce: encodeBase64(nonce)
    };
  }

  static decryptSymmetric(encrypted: EncryptedData, key: Uint8Array): Uint8Array {
    const message = nacl.secretbox.open(
      decodeBase64(encrypted.ciphertext),
      decodeBase64(encrypted.nonce),
      key
    );

    if (!message) {
      throw new Error('Decryption failed');
    }

    return message;
  }

  static generateSymmetricKey(): Uint8Array {
    return nacl.randomBytes(nacl.secretbox.keyLength);
  }

  static encryptEvidence(
    evidenceData: string,
    viewingKeys: string[]
  ): EncryptedEvidence {
    const symmetricKey = this.generateSymmetricKey();
    const encryptedContent = this.encryptSymmetric(evidenceData, symmetricKey);

    const encryptedKeys = viewingKeys.map(publicKey =>
      this.encryptForViewingKey(symmetricKey, publicKey)
    );

    return {
      data: encryptedContent,
      metadata: {
        algorithm: 'xchacha20-poly1305',
        version: 1,
        timestamp: Date.now()
      },
      viewingKeyRequired: true,
      authorizedKeys: encryptedKeys.map(ek => ek.ciphertext)
    };
  }

  static decryptEvidence(
    evidence: EncryptedEvidence,
    privateViewingKey: string,
    encryptedKeyIndex: number
  ): string {
    if (!evidence.authorizedKeys || evidence.authorizedKeys.length === 0) {
      throw new Error('No authorized keys found');
    }

    const encryptedKeyData: EncryptedData = {
      ciphertext: evidence.authorizedKeys[encryptedKeyIndex],
      nonce: evidence.data.nonce,
      ephemeralPublicKey: evidence.data.ephemeralPublicKey
    };

    const symmetricKey = this.decryptWithViewingKey(encryptedKeyData, privateViewingKey);
    const decryptedContent = this.decryptSymmetric(evidence.data, symmetricKey);

    return decodeUTF8(decryptedContent);
  }

  static hashData(data: string | Uint8Array): string {
    const bytes = typeof data === 'string' ? encodeUTF8(data) : data;
    const hash = nacl.hash(bytes);
    return encodeBase64(hash);
  }
}
