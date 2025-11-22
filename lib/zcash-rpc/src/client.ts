import axios, { AxiosInstance } from 'axios';
import * as nacl from 'tweetnacl';

export interface ZcashRPCConfig {
  url: string;
  username?: string;
  password?: string;
  timeout?: number;
}

export interface ShieldedAddress {
  address: string;
  type: 'orchard' | 'sapling' | 'transparent';
}

export interface ShieldedTransaction {
  txid: string;
  confirmations: number;
  blockheight?: number;
  time?: number;
}

export interface ReceivedTransaction {
  txid: string;
  amount: number;
  memo?: string;
  confirmations: number;
  blockheight?: number;
  change: boolean;
}

export class ZcashRPCClient {
  private rpc: AxiosInstance;
  private requestId: number = 0;

  constructor(config: ZcashRPCConfig) {
    this.rpc = axios.create({
      baseURL: config.url,
      timeout: config.timeout || 300000,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(config.username && config.password && {
        auth: {
          username: config.username,
          password: config.password,
        },
      }),
    });
  }

  private async call<T = any>(method: string, params: any[] = []): Promise<T> {
    const response = await this.rpc.post('', {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    });

    if (response.data.error) {
      throw new Error(`Zcash RPC Error: ${response.data.error.message}`);
    }

    return response.data.result;
  }

  async getInfo(): Promise<any> {
    return this.call('getinfo');
  }

  async getBlockCount(): Promise<number> {
    return this.call<number>('getblockcount');
  }

  async getNewAddress(type: 'orchard' | 'sapling' = 'orchard'): Promise<string> {
    return this.call<string>('z_getnewaddress', [type]);
  }

  async validateAddress(address: string): Promise<ShieldedAddress> {
    const result = await this.call<any>('z_validateaddress', [address]);

    if (!result.isvalid) {
      throw new Error(`Invalid address: ${address}`);
    }

    return {
      address: result.address,
      type: result.type || 'sapling',
    };
  }

  async sendShielded(params: {
    from: string;
    to: string;
    amount: number;
    memo?: string;
    expiryHeight?: number;
  }): Promise<string> {
    const operation: any = {
      address: params.to,
      amount: params.amount,
    };

    if (params.memo) {
      operation.memo = Buffer.from(params.memo).toString('hex');
    }

    const sendParams: any[] = [params.from, [operation]];

    if (params.expiryHeight) {
      sendParams.push(1);
      sendParams.push(0);
      sendParams.push('AllowRevealedRecipients');
      sendParams.push(params.expiryHeight);
    }

    const opid = await this.call<string>('z_sendmany', sendParams);
    return opid;
  }

  async getOperationStatus(opid: string): Promise<any> {
    const results = await this.call<any[]>('z_getoperationstatus', [[opid]]);
    return results[0] || { status: 'unknown' };
  }

  async waitForOperation(opid: string, timeoutMs: number = 300000): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getOperationStatus(opid);

      if (status.status === 'success' && status.result?.txid) {
        return status.result.txid;
      }

      if (status.status === 'failed') {
        throw new Error(`Operation failed: ${status.error?.message || 'Unknown error'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Operation timeout');
  }

  async exportViewingKey(address: string): Promise<string> {
    return this.call<string>('z_exportviewingkey', [address]);
  }

  async importViewingKey(viewingKey: string, rescan: boolean = false): Promise<any> {
    const rescanParam = rescan ? 'yes' : 'no';
    return this.call('z_importviewingkey', [viewingKey, rescanParam]);
  }

  async listReceivedByAddress(
    address: string,
    minConf: number = 1
  ): Promise<ReceivedTransaction[]> {
    return this.call<ReceivedTransaction[]>('z_listreceivedbyaddress', [address, minConf]);
  }

  async getTransaction(txid: string): Promise<ShieldedTransaction> {
    const result = await this.call<any>('gettransaction', [txid]);
    return {
      txid: result.txid,
      confirmations: result.confirmations || 0,
      blockheight: result.blockheight,
      time: result.time,
    };
  }

  async getBalance(address: string): Promise<number> {
    return this.call<number>('z_getbalance', [address]);
  }

  async getPaymentDisclosure(
    txid: string,
    jsIndex: number,
    outputIndex: number,
    message?: string
  ): Promise<string> {
    const params = [txid, jsIndex, outputIndex];
    if (message) {
      params.push(message);
    }
    const result = await this.call<any>('z_getpaymentdisclosure', params);
    return result.paymentDisclosure || result;
  }

  async validatePaymentDisclosure(disclosure: string): Promise<boolean> {
    try {
      const result = await this.call<any>('z_validatepaymentdisclosure', [disclosure]);
      return result.valid === true;
    } catch {
      return false;
    }
  }

  async getCurrentHeight(): Promise<number> {
    return this.getBlockCount();
  }

  async estimateFee(): Promise<number> {
    return 0.0001;
  }
}
