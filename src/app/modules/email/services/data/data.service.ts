import * as openpgp from 'openpgp';

import { HttpClient } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';

import { Identity, IdentityService } from '../../../authentication';
import { GmailApiService } from '../gmail-api/gmail-api.service';
import { PgpService } from '../pgp/pgp.service';
import { Oidc2VerificationService } from '../oidc2-verification/oidc2-verification.service';
import { TrustworthyIctIssuer } from '../../types/trustworthy-ict-issuer';
import { OnlinePrivateKey } from '../../types/online-private-key.interface';
import { PrivateKeyOwnership } from '../../types/private-key-ownership.interface';
import { PublicKeyOwnership } from '../../types/public-key-ownership.interface';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  
  /**
   * Constructs a new Email Service instance.
   * @param identityService Identity Service instance.
   * @param http HTTP Client instance.
   */
  constructor(
    private readonly identityService: IdentityService,
    private readonly pgpService: PgpService,
    private readonly gmailApiService: GmailApiService,
    private readonly oidc2VerificationService: Oidc2VerificationService
  ) {  
    this.identityService.identitiesChanged.subscribe(() => this.loadDataOnIdentitiesChanged());
  }

  private async loadDataOnIdentitiesChanged(){
    await this.loadTrustworthyIctIssuersOnIdentitiesChanged()
    this.loadPublicKeyOwnershipsOnIdentitiesChanged()
    this.loadOnlinePrivateKeysOnIdentitiesChanged();
  }

  /**
   * Gets the available gmail identities.
   */
  public get identities(): Identity[] {
    return this.identityService.identities.filter(i => i.hasGoogleIdentityProvider);
  }

  private getIctIdentityAndPrivateKey(identity: Identity): {ictIdentity?: Identity, privateKey?: PrivateKeyOwnership} {
    let ictIdentity = this.identityService.identities.find(i => i.identityProvider.supportsIcts);
    let privateKey = this.pgpService.privateKeys.find(p => p.identity === identity);
    return {ictIdentity, privateKey};
  }

  /**
   * determines wheter a identity can store data
   * @param identity 
   * @returns 
   */
  public canStoreData(identity: Identity): { canStoreData: boolean, errorMessage?: string } {
    let { ictIdentity, privateKey } = this.getIctIdentityAndPrivateKey(identity);

    if(!ictIdentity){
      return {
        canStoreData: false,
        errorMessage: "no ICT-requesting identity available"
      };
    }
    if(!privateKey){
      return {
        canStoreData: false,
        errorMessage: "no private key for signature available"
      };
    }
    if(!identity.hasGoogleIdentityProvider){
      return {
        canStoreData: false,
        errorMessage: "data can only stored in a google-identity"
      }
    }
    return {
      canStoreData: true
    }
  }
 
  // trustworthy ICT issuers

  /**
   * trust ict issuers
   * @param identity 
   * @param issuer 
   * @returns 
   */
  public async trustIctIssuer(identity: Identity, issuer: string):  Promise<TrustworthyIctIssuer | undefined>{
    let { ictIdentity, privateKey } = this.getIctIdentityAndPrivateKey(identity);
    if(ictIdentity && privateKey){
      let messageId = await this.gmailApiService.saveTrustworthyIctIssuer(identity, issuer, ictIdentity, privateKey?.key, privateKey?.passphrase);
      if(messageId){
        return this.oidc2VerificationService.trustIssuer(identity, issuer, messageId);
      }
    }
    return undefined;
  }

  /**
   * load the trustworthy ict issuers on identities changed
   */
  private async loadTrustworthyIctIssuersOnIdentitiesChanged(){
    for(let identity of this.identities){
      let newIssuers = await this.gmailApiService.loadTrustworthyIctIssuers(identity);
      for(let newIssuer of newIssuers){
        let securityResult = await this.pgpService.checkMimeMessageSecurity(newIssuer.mimeMessage, newIssuer.identity, [ newIssuer.issuer ]);
        if(this.pgpService.signaturesAvailableAndValid(securityResult)){
          this.oidc2VerificationService.trustIssuer(newIssuer.identity, newIssuer.issuer, newIssuer.messageId);
        }
      }      
    }
  }

  /**
   * untrust an ICT issuer
   * @param untrustedIssuer 
   */
   public async deleteTrustIssuer(untrustedIssuer: TrustworthyIctIssuer){
    await this.oidc2VerificationService.untrustIssuer(untrustedIssuer);
    await this.gmailApiService.deleteMesage(untrustedIssuer.identity, untrustedIssuer.messageId);
  }

  // public keys

  /**
   * loads the public key ownerships on identities changed
   */
   private async loadPublicKeyOwnershipsOnIdentitiesChanged(){
    for(let identity of this.identities){
      let publicKeyOwnerships = await this.gmailApiService.loadPublicKeyOwnerships(identity);
      for(let publicKeyOwnership of publicKeyOwnerships){
        let securityResult = await this.pgpService.checkMimeMessageSecurity(publicKeyOwnership.mimeMessage, identity);
        if(this.pgpService.signaturesAvailableAndValid(securityResult)){
          let newPublicKeyOwnership  = { identity: publicKeyOwnership.identity,
            publicKeyOwner: publicKeyOwnership.publicKeyOwner,
            key: publicKeyOwnership.key,
            messageId: publicKeyOwnership.messageId};
          this.pgpService.addPublicKeyOwnership(newPublicKeyOwnership);
        }
      }      
    }
  }

  /**
   * save a public key to gmail.
   * @param identity 
   * @param publicKey 
   * @param sender
   */
   public async savePublicKey(identity: Identity, publicKey: openpgp.PublicKey, sender: string){   
    let { ictIdentity, privateKey } = this.getIctIdentityAndPrivateKey(identity);
    if(ictIdentity && privateKey){
      let messageId = await this.gmailApiService.savePublicKey(identity, publicKey, sender, ictIdentity, privateKey?.key, privateKey?.passphrase);
      if(messageId){
        let publicKeyOwnership = {identity, messageId, key: publicKey, publicKeyOwner: sender};
        this.pgpService.addPublicKeyOwnership(publicKeyOwnership);
      }
    } 
  }

  /**
   * delete a public key local and on google
   * @param publicKey 
   */
   public async deletePublicKey(publicKey: PublicKeyOwnership): Promise<void>{
    this.pgpService.removeLocalPublicKey(publicKey);
    if(publicKey.messageId){
      await this.gmailApiService.deleteMesage(publicKey.identity, publicKey.messageId);
    }
  }

  // private keys

  public readonly onlinePrivateKeysChanged = new EventEmitter<void>();

  public onlinePrivateKeys : OnlinePrivateKey[] = [];

  public async loadOnlinePrivateKeysOnIdentitiesChanged(){
    let onlinePrivateKeysTemp: OnlinePrivateKey[] = [];
    for(let identity of this.identities){
      let loadedOnlinePrivateKeys = await this.gmailApiService.loadPrivateKeys(identity);
      
      for(let onlinePrivateKey of loadedOnlinePrivateKeys){
        let securityResult = await this.pgpService.checkMimeMessageSecurity(onlinePrivateKey.mimeMessage, identity);
        
        if(this.pgpService.signaturesAvailableAndValid(securityResult)){                    
          onlinePrivateKeysTemp.push(onlinePrivateKey);
        }
      }      
    }    
    this.onlinePrivateKeys = [...onlinePrivateKeysTemp];
    this.onlinePrivateKeysChanged.emit();
  }

  /**
   * Saves a private key to gmail.
   * @param privateKey PGP Private Key to save.
   */
   public async savePrivateKey(privateKey: PrivateKeyOwnership): Promise<PrivateKeyOwnership | undefined> {
    let ictIdentity = this.identityService.identities.find(i => i.identityProvider.supportsIcts);
    if(privateKey.identity.hasGoogleIdentityProvider && ictIdentity){
      let messageId = await this.gmailApiService.savePrivateKey(privateKey.identity, ictIdentity, privateKey.key, privateKey.passphrase);
      if(messageId){
        privateKey.messageId = messageId;
      }
    }
    
    return undefined;
  }

  
  /**
   * removes a private key and delete it in google 
   * @param privateKey 
   */
   public deletePrivateKey(privateKey: PrivateKeyOwnership): void {
    this.pgpService.removeLocalPrivateKey(privateKey);
    if(privateKey.messageId){
      this.gmailApiService.deleteMesage(privateKey.identity, privateKey.messageId);
    }
  }
}
