import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { EvidenceEncryption } from '@zkfied/crypto';
import { IPFSConfig, IPFSUploadResult, EncryptedIPFSData, PinStatus } from './types';

export class IPFSStorage {
  private gateway: string;
  private pinningAPI?: AxiosInstance;

  constructor(config: IPFSConfig) {
    this.gateway = config.gateway;

    if (config.pinningService) {
      this.pinningAPI = axios.create({
        baseURL: config.pinningService.url,
        headers: {
          'Authorization': `Bearer ${config.pinningService.apiKey}`
        }
      });
    }
  }

  async uploadEncrypted(
    data: Buffer | string,
    viewingKeys: string[]
  ): Promise<EncryptedIPFSData> {
    const dataStr = Buffer.isBuffer(data) ? data.toString('utf8') : data;

    const encryptedEvidence = EvidenceEncryption.encryptEvidence(dataStr, viewingKeys);

    const uploadData = JSON.stringify({
      encrypted: encryptedEvidence.data,
      metadata: encryptedEvidence.metadata,
      authorizedKeys: encryptedEvidence.authorizedKeys
    });

    const result = await this.upload(Buffer.from(uploadData));

    return {
      cid: result.cid,
      encryptedData: encryptedEvidence.data.ciphertext,
      nonce: encryptedEvidence.data.nonce,
      viewingKeyHints: encryptedEvidence.authorizedKeys || []
    };
  }

  async upload(data: Buffer): Promise<IPFSUploadResult> {
    const formData = new FormData();
    formData.append('file', data, { filename: 'evidence.dat' });

    const response = await axios.post(`${this.gateway}/api/v0/add`, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity
    });

    const cid = response.data.Hash;

    if (this.pinningAPI) {
      await this.pin(cid);
    }

    return {
      cid,
      size: response.data.Size,
      url: `${this.gateway}/ipfs/${cid}`
    };
  }

  async retrieve(cid: string): Promise<Buffer> {
    const response = await axios.get(`${this.gateway}/ipfs/${cid}`, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  }

  async retrieveDecrypted(
    cid: string,
    privateViewingKey: string,
    keyIndex: number = 0
  ): Promise<string> {
    const encrypted = await this.retrieve(cid);
    const data = JSON.parse(encrypted.toString('utf8'));

    return EvidenceEncryption.decryptEvidence(
      {
        data: data.encrypted,
        metadata: data.metadata,
        viewingKeyRequired: true,
        authorizedKeys: data.authorizedKeys
      },
      privateViewingKey,
      keyIndex
    );
  }

  async pin(cid: string): Promise<PinStatus> {
    if (!this.pinningAPI) {
      throw new Error('Pinning service not configured');
    }

    const response = await this.pinningAPI.post('/pins', {
      cid,
      name: `zkfied-evidence-${Date.now()}`
    });

    return {
      cid: response.data.pin.cid,
      status: response.data.status,
      created: response.data.created
    };
  }

  async getPinStatus(cid: string): Promise<PinStatus> {
    if (!this.pinningAPI) {
      throw new Error('Pinning service not configured');
    }

    const response = await this.pinningAPI.get(`/pins/${cid}`);

    return {
      cid: response.data.pin.cid,
      status: response.data.status,
      created: response.data.created
    };
  }

  async unpin(cid: string): Promise<void> {
    if (!this.pinningAPI) {
      throw new Error('Pinning service not configured');
    }

    await this.pinningAPI.delete(`/pins/${cid}`);
  }
}
