import {
  SmartContract,
  state,
  State,
  method,
  Field,
  PublicKey,
  Signature,
  Poseidon,
  Bool,
  UInt64,
} from 'o1js';

export class CredentialIssuer extends SmartContract {
  @state(PublicKey) issuerPublicKey = State<PublicKey>();
  @state(Field) credentialCount = State<Field>();

  init() {
    super.init();
    this.issuerPublicKey.set(this.sender.getAndRequireSignature());
    this.credentialCount.set(Field(0));
  }

  @method async issueCredential(
    holderPublicKey: PublicKey,
    credentialType: Field,
    issuerSignature: Signature
  ): Promise<Field> {
    const issuer = this.issuerPublicKey.getAndRequireEquals();

    const validSignature = issuerSignature.verify(issuer, [
      ...holderPublicKey.toFields(),
      credentialType,
    ]);
    validSignature.assertTrue();

    const timestamp = this.network.blockchainLength.getAndRequireEquals();

    const credentialHash = Poseidon.hash([
      ...holderPublicKey.toFields(),
      credentialType,
      timestamp.value,
    ]);

    const count = this.credentialCount.getAndRequireEquals();
    this.credentialCount.set(count.add(1));

    this.emitEvent('CredentialIssued', credentialHash);

    return credentialHash;
  }

  @method async verifyCredential(
    holderPublicKey: PublicKey,
    credentialType: Field,
    timestamp: UInt64,
    boardType: Field
  ): Promise<Bool> {
    const credentialHash = Poseidon.hash([
      ...holderPublicKey.toFields(),
      credentialType,
      timestamp.value,
    ]);

    const healthcare = Field(1);
    const government = Field(2);
    const corporate = Field(3);

    const doctor = Field(1);
    const nurse = Field(2);
    const journalist = Field(3);
    const laborer = Field(4);

    const healthcareMatch = credentialType
      .equals(doctor)
      .or(credentialType.equals(nurse))
      .and(boardType.equals(healthcare));

    const governmentMatch = credentialType
      .equals(journalist)
      .and(boardType.equals(government));

    const corporateMatch = credentialType
      .equals(laborer)
      .and(boardType.equals(corporate));

    return healthcareMatch.or(governmentMatch).or(corporateMatch);
  }

  @method async revokeCredential(
    credentialHash: Field,
    issuerSignature: Signature
  ) {
    const issuer = this.issuerPublicKey.getAndRequireEquals();

    const validSignature = issuerSignature.verify(issuer, [credentialHash]);
    validSignature.assertTrue();

    this.emitEvent('CredentialRevoked', credentialHash);
  }
}
