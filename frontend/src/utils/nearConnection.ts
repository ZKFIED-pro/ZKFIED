import * as nearAPI from 'near-api-js';
import { Contract } from 'near-api-js';

const { connect, keyStores, WalletConnection } = nearAPI;

// Get config from environment variables
const getConfig = () => {
  const network = import.meta.env.VITE_NEAR_NETWORK || 'testnet';

  return {
    networkId: network,
    nodeUrl: import.meta.env.VITE_NEAR_RPC_URL || `https://rpc.${network}.near.org`,
    walletUrl: `https://wallet.${network}.near.org`,
    helperUrl: `https://helper.${network}.near.org`,
    explorerUrl: `https://explorer.${network}.near.org`,
    // Contract addresses
    registryContractId: import.meta.env.VITE_NEAR_REGISTRY_CONTRACT || 'reg.mrhashfox.testnet',
    indexerContractId: import.meta.env.VITE_NEAR_INDEXER_CONTRACT || 'idx.mrhashfox.testnet',
    tippingContractId: import.meta.env.VITE_NEAR_TIPPING_CONTRACT || 'tip.mrhashfox.testnet',
    aiAgentsContractId: import.meta.env.VITE_NEAR_AI_AGENTS_CONTRACT || 'ai.mrhashfox.testnet',
  };
};

// Initialize connection to NEAR
export const initNearConnection = async () => {
  const nearConfig = getConfig();

  // Creates keyStore from browser local storage
  const keyStore = new keyStores.BrowserLocalStorageKeyStore();

  const connectionConfig = {
    networkId: nearConfig.networkId,
    keyStore,
    nodeUrl: nearConfig.nodeUrl,
    walletUrl: nearConfig.walletUrl,
    helperUrl: nearConfig.helperUrl,
    headers: {},
  };

  // Connect to NEAR
  const near = await connect(connectionConfig);

  // Create wallet connection
  const wallet = new WalletConnection(near, 'zkfied');

  return { near, wallet, config: nearConfig };
};

// Get evidence registry contract instance
export const getEvidenceRegistryContract = (wallet: WalletConnection, contractId: string) => {
  return new Contract(
    wallet.account(),
    contractId,
    {
      viewMethods: [
        'get_evidence',
        'get_total_evidences',
        'query_evidences_by_board',
        'verify_evidence_commitment',
        'get_evidence_verifications',
      ],
      changeMethods: [
        'register_evidence',
        'submit_verification',
      ],
    }
  );
};

// Get evidence indexer contract instance
export const getEvidenceIndexerContract = (wallet: WalletConnection, contractId: string) => {
  return new Contract(
    wallet.account(),
    contractId,
    {
      viewMethods: [
        'search_evidence',
        'get_evidence_by_id',
      ],
      changeMethods: [
        'index_evidence',
      ],
    }
  );
};

// Get tipping contract instance
export const getTippingContract = (wallet: WalletConnection, contractId: string) => {
  return new Contract(
    wallet.account(),
    contractId,
    {
      viewMethods: [
        'get_tips_for_evidence',
        'get_total_tips',
      ],
      changeMethods: [
        'tip_evidence',
      ],
    }
  );
};

// Get AI agents contract instance
export const getAIAgentsContract = (wallet: WalletConnection, contractId: string) => {
  return new Contract(
    wallet.account(),
    contractId,
    {
      viewMethods: [
        'get_agent',
        'query_agents',
      ],
      changeMethods: [
        'register_agent',
        'update_agent_status',
      ],
    }
  );
};

// Singleton instance
let nearInstance: {
  near: nearAPI.Near;
  wallet: WalletConnection;
  config: ReturnType<typeof getConfig>;
} | null = null;

// Get or create NEAR connection
export const getNearConnection = async () => {
  if (!nearInstance) {
    nearInstance = await initNearConnection();
  }
  return nearInstance;
};

// Check if user is signed in
export const isSignedIn = async () => {
  const { wallet } = await getNearConnection();
  return wallet.isSignedIn();
};

// Get current account ID
export const getAccountId = async () => {
  const { wallet } = await getNearConnection();
  return wallet.getAccountId();
};

// Sign in with NEAR wallet
export const signIn = async () => {
  const { wallet } = await getNearConnection();
  wallet.requestSignIn({
    contractId: getConfig().registryContractId,
    methodNames: ['register_evidence', 'submit_verification'],
  });
};

// Sign out
export const signOut = async () => {
  const { wallet } = await getNearConnection();
  wallet.signOut();
  nearInstance = null;
};
