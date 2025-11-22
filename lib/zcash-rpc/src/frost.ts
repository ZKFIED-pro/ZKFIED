import { ZcashRPCClient } from './client';
import { MemoEncoder, BoardCategory } from './memo';
import { createHash, randomBytes } from 'crypto';
import * as nacl from 'tweetnacl';

export interface BoardMember {
  id: string;
  organization: string;
  address: string;
  publicKey: string;
}

export interface FROSTBoard {
  boardId: string;
  category: BoardCategory;
  threshold: number;
  members: BoardMember[];
  coordinatorAddress: string;
}

export interface AuthorizationRequest {
  requestId: string;
  whistleblowerPseudonym: string;
  board: BoardCategory;
  credentialHash: string;
  timestamp: number;
}

export interface AuthorizationResponse {
  requestId: string;
  approved: boolean;
  signature: string;
  signingMembers: string[];
  expiryTimestamp: number;
}

export class FROSTCoordinator {
  constructor(private client: ZcashRPCClient) {}

  async createBoard(params: {
    category: BoardCategory;
    threshold: number;
    members: Omit<BoardMember, 'publicKey'>[];
    coordinatorAddress: string;
  }): Promise<FROSTBoard> {
    const membersWithKeys: BoardMember[] = params.members.map(m => ({
      ...m,
      publicKey: this.generatePublicKey(m.id),
    }));

    const boardId = this.generateBoardId(params.category, membersWithKeys);

    const board: FROSTBoard = {
      boardId,
      category: params.category,
      threshold: params.threshold,
      members: membersWithKeys,
      coordinatorAddress: params.coordinatorAddress,
    };

    const boardMemo = JSON.stringify({
      type: 'frost_board_setup',
      board,
      timestamp: Date.now(),
    });

    const opid = await this.client.sendShielded({
      from: params.coordinatorAddress,
      to: params.coordinatorAddress,
      amount: 0.0001,
      memo: boardMemo,
    });

    await this.client.waitForOperation(opid);

    return board;
  }

  async requestAuthorization(params: {
    board: FROSTBoard;
    whistleblowerAddress: string;
    credentialHash: string;
    whistleblowerPseudonym: string;
  }): Promise<AuthorizationRequest> {
    const requestId = randomBytes(32).toString('hex');

    const request: AuthorizationRequest = {
      requestId,
      whistleblowerPseudonym: params.whistleblowerPseudonym,
      board: params.board.category,
      credentialHash: params.credentialHash,
      timestamp: Date.now(),
    };

    const requestMemo = MemoEncoder.encodeFROSTRequest(
      params.credentialHash,
      params.board.category
    );

    const opid = await this.client.sendShielded({
      from: params.whistleblowerAddress,
      to: params.board.coordinatorAddress,
      amount: 0.0001,
      memo: requestMemo,
    });

    await this.client.waitForOperation(opid);

    return request;
  }

  async signAuthorization(params: {
    board: FROSTBoard;
    request: AuthorizationRequest;
    memberAddress: string;
    privateKeyShare: string;
  }): Promise<string> {
    const message = this.createAuthorizationMessage(params.request);
    const signature = this.signMessage(message, params.privateKeyShare);

    const signatureMemo = JSON.stringify({
      type: 'frost_signature_share',
      requestId: params.request.requestId,
      memberAddress: params.memberAddress,
      signature,
      timestamp: Date.now(),
    });

    const opid = await this.client.sendShielded({
      from: params.memberAddress,
      to: params.board.coordinatorAddress,
      amount: 0.0001,
      memo: signatureMemo,
    });

    await this.client.waitForOperation(opid);

    return signature;
  }

  async aggregateAuthorization(params: {
    board: FROSTBoard;
    request: AuthorizationRequest;
    timeoutMs?: number;
  }): Promise<AuthorizationResponse> {
    const timeout = params.timeoutMs || 300000;
    const startTime = Date.now();

    const signatures: Map<string, string> = new Map();

    while (Date.now() - startTime < timeout) {
      const received = await this.client.listReceivedByAddress(
        params.board.coordinatorAddress,
        0
      );

      for (const tx of received) {
        if (!tx.memo) continue;

        try {
          const memo = JSON.parse(tx.memo);
          if (
            memo.type === 'frost_signature_share' &&
            memo.requestId === params.request.requestId
          ) {
            signatures.set(memo.memberAddress, memo.signature);
          }
        } catch {
          continue;
        }
      }

      if (signatures.size >= params.board.threshold) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    if (signatures.size < params.board.threshold) {
      throw new Error(
        `Insufficient signatures: ${signatures.size}/${params.board.threshold}`
      );
    }

    const aggregatedSignature = this.aggregateSignatures(Array.from(signatures.values()));

    const response: AuthorizationResponse = {
      requestId: params.request.requestId,
      approved: true,
      signature: aggregatedSignature,
      signingMembers: Array.from(signatures.keys()),
      expiryTimestamp: Date.now() + 30 * 24 * 3600 * 1000,
    };

    const responseMemo = MemoEncoder.encodeFROSTAuthorization(
      params.request.requestId,
      aggregatedSignature,
      true
    );

    const opid = await this.client.sendShielded({
      from: params.board.coordinatorAddress,
      to: params.board.coordinatorAddress,
      amount: 0.0001,
      memo: responseMemo,
    });

    await this.client.waitForOperation(opid);

    return response;
  }

  async verifyAuthorization(
    board: FROSTBoard,
    response: AuthorizationResponse
  ): Promise<boolean> {
    if (response.signingMembers.length < board.threshold) {
      return false;
    }

    if (Date.now() > response.expiryTimestamp) {
      return false;
    }

    return true;
  }

  private generatePublicKey(memberId: string): string {
    const keyPair = nacl.sign.keyPair.fromSeed(
      createHash('sha256').update(memberId).digest().slice(0, 32)
    );
    return Buffer.from(keyPair.publicKey).toString('hex');
  }

  private generateBoardId(category: BoardCategory, members: BoardMember[]): string {
    const memberIds = members.map(m => m.id).sort().join('');
    return createHash('blake2b512')
      .update(category.toString() + memberIds)
      .digest()
      .slice(0, 32)
      .toString('hex');
  }

  private createAuthorizationMessage(request: AuthorizationRequest): string {
    return JSON.stringify({
      requestId: request.requestId,
      board: request.board,
      credentialHash: request.credentialHash,
      timestamp: request.timestamp,
    });
  }

  private signMessage(message: string, privateKey: string): string {
    const messageHash = createHash('blake2b512').update(message).digest();
    const keyPair = nacl.sign.keyPair.fromSeed(
      Buffer.from(privateKey, 'hex').slice(0, 32)
    );
    const signature = nacl.sign.detached(messageHash, keyPair.secretKey);
    return Buffer.from(signature).toString('hex');
  }

  private aggregateSignatures(signatures: string[]): string {
    const combined = signatures.join('');
    return createHash('blake2b512')
      .update(combined)
      .digest()
      .slice(0, 64)
      .toString('hex');
  }
}
