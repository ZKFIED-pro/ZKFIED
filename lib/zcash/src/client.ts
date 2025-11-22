import axios, { AxiosInstance } from 'axios';
import {
  ZcashAddress,
  ShieldedTransactionParams,
  ZcashTransaction,
  ViewingKey,
  DecryptedMemo,
  ZcashRPCConfig
} from './types';
import { MemoEncoder } from './memo';

export class ZcashClient {
  private rpc: AxiosInstance;

  constructor(config: ZcashRPCConfig) {
    this.rpc = axios.create({
      baseURL: config.url,
      headers: {
        'Content-Type': 'application/json'
      },
      ...(config.username && config.password && {
        auth: {
          username: config.username,
          password: config.password
        }
      })
    });
  }

  private async call(method: string, params: unknown[] = []): Promise<unknown> {
    const response = await this.rpc.post('', {
      jsonrpc: '1.0',
      id: Date.now(),
      method,
      params
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data.result;
  }

  async getNewShieldedAddress(): Promise<string> {
    return await this.call('z_getnewaddress', ['sapling']) as string;
  }

  async validateAddress(address: string): Promise<ZcashAddress> {
    const result = await this.call('z_validateaddress', [address]) as {
      isvalid: boolean;
      address: string;
      type?: string;
    };

    if (!result.isvalid) {
      throw new Error('Invalid Zcash address');
    }

    return {
      address: result.address,
      type: result.type === 'sapling' ? 'shielded' : 'transparent'
    };
  }

  async sendShieldedTransaction(params: ShieldedTransactionParams): Promise<string> {
    const { from, to, amount, memo } = params;

    const operation: Record<string, unknown> = {
      address: to,
      amount
    };

    if (memo) {
      const encodedMemo = MemoEncoder.encode(memo);
      operation.memo = encodedMemo.hex;
    }

    const opid = await this.call('z_sendmany', [from, [operation]]) as string;

    return opid;
  }

  async getOperationStatus(opid: string): Promise<{ status: string; result?: { txid: string } }> {
    const results = await this.call('z_getoperationstatus', [[opid]]) as Array<{
      id: string;
      status: string;
      result?: { txid: string };
    }>;

    return results[0] || { status: 'unknown' };
  }

  async waitForOperation(opid: string, timeoutMs: number = 60000): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getOperationStatus(opid);

      if (status.status === 'success' && status.result?.txid) {
        return status.result.txid;
      }

      if (status.status === 'failed') {
        throw new Error('Operation failed');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Operation timeout');
  }

  async exportViewingKey(address: string): Promise<ViewingKey> {
    const key = await this.call('z_exportviewingkey', [address]) as string;

    return {
      address,
      key,
      type: 'incoming'
    };
  }

  async importViewingKey(viewingKey: string): Promise<{ address: string }> {
    const result = await this.call('z_importviewingkey', [viewingKey, 'yes']) as {
      type: string;
      address: string;
    };

    return { address: result.address };
  }

  async listReceivedByAddress(address: string, minConf: number = 1): Promise<Array<{
    txid: string;
    amount: number;
    memo?: string;
    confirmations: number;
  }>> {
    const results = await this.call('z_listreceivedbyaddress', [address, minConf]) as Array<{
      txid: string;
      amount: number;
      memo?: string;
      confirmations: number;
    }>;

    return results;
  }

  async decryptMemos(address: string): Promise<DecryptedMemo[]> {
    const received = await this.listReceivedByAddress(address);

    return received
      .filter(tx => tx.memo)
      .map(tx => MemoEncoder.decode(tx.memo!));
  }

  async getTransaction(txid: string): Promise<ZcashTransaction> {
    const result = await this.call('gettransaction', [txid]) as {
      txid: string;
      confirmations: number;
      blockheight?: number;
      time?: number;
    };

    return {
      txid: result.txid,
      confirmations: result.confirmations,
      blockHeight: result.blockheight,
      timestamp: result.time
    };
  }

  async getBalance(address: string): Promise<number> {
    const balance = await this.call('z_getbalance', [address]) as number;
    return balance;
  }
}
