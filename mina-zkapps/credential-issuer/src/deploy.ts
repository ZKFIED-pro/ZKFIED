import { Mina, PrivateKey, AccountUpdate } from 'o1js';
import { CredentialIssuer } from './CredentialIssuer.js';

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

  const deployerKey = PrivateKey.fromBase58(
    process.env.DEPLOYER_PRIVATE_KEY ||
      PrivateKey.random().toBase58()
  );
  const deployer = deployerKey.toPublicKey();

  const zkAppPrivateKey = PrivateKey.fromBase58(
    process.env.ZKAPP_PRIVATE_KEY ||
      PrivateKey.random().toBase58()
  );
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  console.log('Compiling smart contract...');
  await CredentialIssuer.compile();

  const zkApp = new CredentialIssuer(zkAppAddress);

  console.log('Deploying smart contract...');
  const tx = await Mina.transaction(deployer, async () => {
    AccountUpdate.fundNewAccount(deployer);
    await zkApp.deploy();
  });

  await tx.prove();
  await tx.sign([deployerKey, zkAppPrivateKey]).send();

  console.log('zkApp deployed to:', zkAppAddress.toBase58());
  console.log('Deployer:', deployer.toBase58());
}

main();
