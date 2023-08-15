import { EventEmitter, Injectable } from '@angular/core';
import * as openpgp from 'openpgp';
import { Identity, IdentityService } from 'src/app/modules/authentication';

@Injectable({
  providedIn: 'root'
})
export class PgpService {
  // Key Management:

  /**
   * Internal represenatation of all private keys.
   */
  private readonly _privateKeys: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }[] = [];
  /**
   * Gets a readonly array of all private keys.
   */
  public get privateKeys(): { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }[] {
    return [ ...this._privateKeys ];
  }

  public readonly privateKeysChange = new EventEmitter<void>();

  /**
   * Adds a PGP private key to privateKeys.
   * @param privateKey PGP Private Key to add.
   */
  public addPrivateKey(privateKey: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }): void {
    // Add private key to array of private keys.
    this._privateKeys.push(privateKey);

    // Register the private key for all corresponding identities.
    for (const identity of privateKey.identities) {
      this.addKeyFor(identity, privateKey);
    }

    this.privateKeysChange.emit();
  }

  /**
   * Removes a PGP Private Key from privateKeys.
   * @param privateKey PGP Private Key to remove.
   */
  public removePrivateKey(privateKey: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }): void {
    const index = this._privateKeys.indexOf(privateKey);
    this._privateKeys.splice(index, 1);

    this.privateKeysChange.emit();
  }

  // Identity -> Key Mapping:

  /**
   * Mapping from an identity instance to its corresponding PGP keys.
   */
  private readonly _identityPrivateKeys = new Map<Identity, { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }[]>();

  /**
   * Adds a PGP private key for an identity.
   * @param identity Identity.
   * @param key PGP Private Key.
   */
  public addKeyFor(identity: Identity, key: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }) {
    const keys = this._identityPrivateKeys.get(identity);
    if (keys) {
      keys.push(key);
    } else {
      this._identityPrivateKeys.set(identity, [key]);
    }
  }

  /**
   * Gets all registered keys for an identity.
   * @param identity Identity to get keys for.
   * @returns The PGP Key for the requested identity.
   */
  public getKeysFor(identity: Identity): { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }[] {
    return this._identityPrivateKeys.get(identity) ?? [];
  }

  // Key Generation / Import:

  /**
   * Generates a new PGP Key Pair.
   * @param userId UserID.
   * @param passphrase Passphrase.
   * @returns Generated key pair.
   */
  public async generateKeyPair(userId: { name: string, email: string }, passphrase: string): Promise<openpgp.KeyPair> {
    // Generate the key pair.
    const generatedArmoredKeyPair = await openpgp.generateKey({
      type: 'ecc',
      curve: 'p384',
      userIDs: [userId],
      passphrase: passphrase,
      format: 'armored',
    });

    // Read the key pair and return it.
    return this.importKeyPair(generatedArmoredKeyPair);
  }

  /**
   * Imports a PGP private key.
   * @param armoredPrivateKey Armored ürivate key to import.
   * @returns Imported PGP private key.
   */
  public async importPrivateKey(armoredPrivateKey: string): Promise<openpgp.PrivateKey> {
    return await openpgp.readPrivateKey({
      armoredKey: armoredPrivateKey,
    });
  }

  /**
   * Imports a PGP public key.
   * @param armoredPublicKey Armored public key to import.
   * @returns Imported PGP public key.
   */
  public async importPublicKey(armoredPublicKey: string): Promise<openpgp.PublicKey> {
    return await openpgp.readKey({
      armoredKey: armoredPublicKey,
    });
  }

  /**
   * Imports a PGP key pair.
   * @param armoredKeyPair Key pair to import.
   * @returns Imported PGP key pair.
   */
  public async importKeyPair(armoredKeyPair: { publicKey: string, privateKey: string }): Promise<openpgp.KeyPair> {
    // Import each key pair.
    const [privateKey, publicKey] = await Promise.all([
      this.importPrivateKey(armoredKeyPair.privateKey),
      this.importPublicKey(armoredKeyPair.publicKey),
    ]);
    // Return imported keys as key pair.
    return {
      privateKey,
      publicKey,
    };
  }

  constructor(
    private readonly identityService: IdentityService,
  ) { }


}
