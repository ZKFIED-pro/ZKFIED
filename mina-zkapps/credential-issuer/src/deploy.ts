import { Mina, PrivateKey, AccountUpdate } from 'o1js';
import { CredentialIssuer } from './CredentialIssuer.js';
import * as dotenv from 'dotenv';

dotenv.config();

const deployToTestnet = process.argv[2] === 'testnet';

async function main() {
  let Network;
  if (deployToTestnet) {
    Network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');
  } else {
    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Network = Local;
  }
  Mina.setActiveInstance(Network);

  
  const deployerKey = PrivateKey.fromBase58(process.env.MINA_PRIVATE_KEY!);
  const deployer = deployerKey.toPublicKey();

  
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  console.log('Using deployer address:', deployer.toBase58());
  console.log('Generated zkApp private key:', zkAppPrivateKey.toBase58());
  console.log('Generated zkApp public key:', zkAppAddress.toBase58());

  console.log('Compiling smart contract...');
  await CredentialIssuer.compile();

  const zkApp = new CredentialIssuer(zkAppAddress);

  console.log('Deploying smart contract...');
  const tx = await Mina.transaction(
    { sender: deployer, fee: 100_000_000 }, // Set fee to 0.1 MINA 
    async () => {
      AccountUpdate.fundNewAccount(deployer);
      await zkApp.deploy();
    }
  );

  await tx.prove();
  await tx.sign([deployerKey, zkAppPrivateKey]).send();

  console.log('zkApp deployed to:', zkAppAddress.toBase58());
  console.log('Deployer:', deployer.toBase58());
}

main();
