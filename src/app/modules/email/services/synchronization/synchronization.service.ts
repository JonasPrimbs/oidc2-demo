import * as openpgp from 'openpgp';

import { EventEmitter, Injectable } from '@angular/core';
import { Identity, IdentityService } from '../../../authentication';
import { GmailApiService, MessageResult } from '../gmail-api/gmail-api.service';
import { PgpService } from '../pgp/pgp.service';
import { PgpKeyAuthenticationService } from '../pgp-key-authentication/pgp-key-authentication.service';
import { TrustworthyIctIssuer, TrustworthyIctIssuerExtended } from '../../types/trustworthy-ict-issuer';
import { OnlinePrivateKey } from '../../types/online-private-key.interface';
import { PrivateKeyOwnership } from '../../types/private-key-ownership.interface';
import { PublicKeyOwnership, PublicKeyOwnershipExtended } from '../../types/public-key-ownership.interface';
import { MimeMessageSecurityResult } from '../../types/mime-message-security-result.interface';
import { MimeMessage } from '../../classes/mime-message/mime-message';
import { EmailService } from '../email/email.service';
import { EmailContent } from '../../classes/email-content/email-content';
import { Email } from '../../classes/email/email';
import { PgpKeyCertificationService } from '../pgp-key-certification/pgp-key-certification.service';
import { AttachmentFile } from '../../classes/attachment-file/attachment-file';

@Injectable({
  providedIn: 'root',
})
export class SynchronizationService {
  
  readonly privateKeyLabelName = "PRIVATE_KEY";
  readonly publicKeyLabelName = "PUBLIC_KEY";
  readonly trustworthyIctIssuerLabelName = "TRUSTWORTHY_ICT_ISSUER";

  readonly publicKeyAttachmentFileName = "public_key.asc";
  readonly privateKeyAttachmentFileName = "private_key.asc";
  readonly trustworthyIctIssuerAttachmentFileName = "trustworthy_ict_issuer.txt";

  /**
   * Constructs a new Email Service instance.
   * @param identityService Identity Service instance.
   * @param http HTTP Client instance.
   */
  constructor(
    private readonly identityService: IdentityService,
    private readonly pgpService: PgpService,
    private readonly gmailApiService: GmailApiService,
    private readonly oidc2VerificationService: PgpKeyAuthenticationService,
    private readonly emailService: EmailService,
    private readonly oidc2AttachmentService: PgpKeyCertificationService,
  ) {  
    this.identityService.identitiesChanged.subscribe(() => this.loadData());
    this.pgpService.privateKeysChanged.subscribe(() => this.loadPublicKeyOwnershipsOnIdentitiesChanged());
  }

  private async loadData(){
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
  public async saveTrustIctIssuer(identity: Identity, issuer: string):  Promise<TrustworthyIctIssuer | undefined>{
    let { ictIdentity, privateKey } = this.getIctIdentityAndPrivateKey(identity);
    if(ictIdentity && privateKey){
      let explanation = `the attachment ${this.trustworthyIctIssuerAttachmentFileName} contains your trust into the ICT-issuer ${issuer}.
        After deleting this mail you revoke your trust into the ICT issuer.`;
      let attachment = new AttachmentFile(this.trustworthyIctIssuerAttachmentFileName, issuer, "text/plain", "trustworthy_ict_issuer");
      let message = await this.saveData(identity, "ict_issuer", [ attachment ], this.trustworthyIctIssuerLabelName, ictIdentity, privateKey?.key, privateKey?.passphrase, explanation);
    
      if(message?.id){
        return this.oidc2VerificationService.trustIssuer(identity, issuer, message.id);
      }
    }
    return undefined;
  }


  public readonly untrustedIctIssuersChanged = new EventEmitter<void>();

  private _unturstedIctIssuers : TrustworthyIctIssuerExtended[] = [];

  public get untrustedIctIssuers() : TrustworthyIctIssuerExtended[]{
    return this._unturstedIctIssuers;
  }

  /**
   * load the trustworthy ict issuers on identities changed
   */
  private async loadTrustworthyIctIssuersOnIdentitiesChanged(){
    let trustworthyIctIssuers : TrustworthyIctIssuer[] = [];
    let untrustedIctIssuers : TrustworthyIctIssuerExtended[] = [];
    for(let identity of this.identities){
      let newIssuers = await this.loadTrustworthyIctIssuers(identity);
      for(let newIssuer of newIssuers){
        let securityResult = await this.oidc2VerificationService.authenticatePgpKey(newIssuer.mimeMessage, newIssuer.identity, this.oidc2VerificationService.trustworthyRootIssuers);
        if(this.pgpService.signaturesAvailableAndValid(securityResult) && this.pgpService.isMailFromSender(identity.claims.email!, securityResult)){
          trustworthyIctIssuers.push({identity: newIssuer.identity, issuer: newIssuer.issuer, messageId: newIssuer.messageId})
        }
        else if(this.hasValidPopAndPGPSignature(securityResult)){
          untrustedIctIssuers.push(newIssuer);
        }
      }      
    }
    this.oidc2VerificationService.setTrustworthyIctIssuers(trustworthyIctIssuers);
    this._unturstedIctIssuers = [];
    this._unturstedIctIssuers.push(...untrustedIctIssuers);
    this.untrustedIctIssuersChanged.emit();
  }

  private hasValidPopAndPGPSignature(securityResult: MimeMessageSecurityResult): boolean{
    let validPop = false;
    let validPgpSignature = false;

    for(let oidc2verificationResult of securityResult.oidc2VerificationResults){
      if(oidc2verificationResult.popVerified){
        validPop = true;
        break;
      }
    }

    for(let signatureVerificationResult of securityResult.signatureVerificationResults){
      if(signatureVerificationResult.signatureVerified){
        validPgpSignature = true;
        break;
      }
    }

    return validPgpSignature && validPop;
  }

  public async trustUntrustedIssuer(trustedIctIssuer: TrustworthyIctIssuerExtended){
    let securityResult = await this.oidc2VerificationService.authenticatePgpKey(trustedIctIssuer.mimeMessage, trustedIctIssuer.identity, [trustedIctIssuer.issuer]);
    if(this.pgpService.signaturesAvailableAndValid(securityResult) && this.pgpService.isMailFromSender(trustedIctIssuer.identity.claims.email!, securityResult)){
      this.oidc2VerificationService.trustIssuer( trustedIctIssuer.identity, trustedIctIssuer.issuer, trustedIctIssuer.messageId);
      this.oidc2VerificationService.addRootIctIssuer(trustedIctIssuer.issuer);
      this.loadData();
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
    let publicKeys: PublicKeyOwnership[] = [];
    for(let identity of this.identities){
      let publicKeyOwnerships = await this.loadPublicKeyOwnerships(identity);
      for(let publicKeyOwnership of publicKeyOwnerships){
        let securityResult = await this.oidc2VerificationService.authenticatePgpKey(publicKeyOwnership.mimeMessage, identity);
        let mimeMessage = publicKeyOwnership.mimeMessage;
        if(securityResult.encrypted && securityResult.decryptionSuccessful && securityResult.clearetextMimeMessage){
          mimeMessage = securityResult.clearetextMimeMessage;
        }
        if(securityResult.encrypted && !securityResult.decryptionSuccessful){
          continue; 
        }
        if(this.pgpService.signaturesAvailableAndValid(securityResult) && this.pgpService.isMailFromSender(identity.claims.email!, securityResult)){
          let newPublicKeyOwnership  = await this.getPublicKeyOwnership(mimeMessage, publicKeyOwnership.identity, publicKeyOwnership.messageId);
          if(newPublicKeyOwnership){
            publicKeys.push(newPublicKeyOwnership!);
          }
        }
      }      
    }
    this.pgpService.setPublicKeyOwnerships(publicKeys);
  }

  /**
   * create a public key ownership of a mime message
   * @param mimeMessage 
   * @param identity 
   * @param mailId 
   * @returns 
   */
  private async getPublicKeyOwnership(mimeMessage: MimeMessage, identity: Identity, mailId: string) : Promise<PublicKeyOwnership | undefined>{
    let publicKeyOwnershipAttachment = mimeMessage.payload.attachments.find(a => a.name === this.publicKeyAttachmentFileName);
    if(publicKeyOwnershipAttachment){
      let publicKey = await openpgp.readKey({ armoredKey: publicKeyOwnershipAttachment.decodedText() });
      return { 
        identity: identity, 
        publicKeyOwner: mimeMessage.payload.subject ?? '',
        key: publicKey, 
        messageId: mailId,
      };
    }
    return undefined;
  }

  /**
   * save a public key to gmail.
   * @param identity 
   * @param publicKey 
   * @param sender
   */
  public async savePublicKey(identity: Identity, publicKey: openpgp.PublicKey, sender: string): Promise<PublicKeyOwnership|undefined>{   
    let { ictIdentity, privateKey } = this.getIctIdentityAndPrivateKey(identity);
    if(ictIdentity && privateKey){
      
      let explanation = `The attachment ${this.publicKeyAttachmentFileName} contains the PGP-public-key of ${sender}. 
      After deleting this mail you can't encrypt a mail for ${sender} with the Key 0x${publicKey.getKeyID().toHex().toUpperCase()}.`;
      const attachment = new AttachmentFile(this.publicKeyAttachmentFileName, publicKey.armor(), "text/plain");
      let message = await this.saveData(identity, sender, [attachment], this.publicKeyLabelName, ictIdentity, privateKey?.key, privateKey?.passphrase, explanation, true);

      if(message?.id){
        let publicKeyOwnership = {identity, messageId: message.id, key: publicKey, publicKeyOwner: sender};
        this.pgpService.addPublicKeyOwnership(publicKeyOwnership);
        return publicKeyOwnership;
      }
    } 
    return undefined;
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
      let loadedOnlinePrivateKeys = await this.loadPrivateKeys(identity);
      
      for(let onlinePrivateKey of loadedOnlinePrivateKeys){
        let securityResult = await this.oidc2VerificationService.authenticatePgpKey(onlinePrivateKey.mimeMessage, identity);        
        if(this.pgpService.signaturesAvailableAndValid(securityResult) && this.pgpService.isMailFromSender(identity.claims.email!, securityResult)){               
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
      let explanation = `The attachment ${this.privateKeyAttachmentFileName} contains your encrypted private key with the KeyId 0x${ privateKey.key.getKeyID().toHex().toUpperCase() }.
        After deleting this mail you can neither decrypt nor sign mails with this private key.`;
      const attachment = new AttachmentFile(this.privateKeyAttachmentFileName, privateKey.key.armor(), "text/plain");    
      let message = await this.saveData(ictIdentity, "private_key", [attachment], this.privateKeyLabelName, ictIdentity, privateKey.key, privateKey.passphrase, explanation);
      if(message?.id){
        privateKey.messageId = message.id;
        return privateKey;
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


  /**
   * saves attachment-file data to a mail with a specific label
   * @param identity 
   * @param subject 
   * @param attachments 
   * @param labelName 
   * @returns 
   */
  private async saveData(identity: Identity, subject: string, attachments: AttachmentFile[], labelName: string, ictIdentity: Identity, privateKey: openpgp.PrivateKey, passphrase: string, explanation: string, encrypted: boolean = false): Promise<MessageResult | undefined>{    
    let emailBody = new EmailContent(explanation);
    const email = new Email(identity, identity.claims.email ?? "", subject, [emailBody, ...attachments]);

    const ictPopAttachments = await this.oidc2AttachmentService.generateIctPopAttachments([ictIdentity], email.receiver, privateKey);

    ictPopAttachments.forEach(a => email.parts.push(a));

    let mimeMessage: string = "";
    if(encrypted){
      let encryptionKey = await openpgp.decryptKey({privateKey, passphrase});      
      mimeMessage = await this.emailService.getEmailRawEncryptedMimeString(email, [encryptionKey], privateKey, passphrase)
    }
    else{
      mimeMessage = await this.emailService.getEmailRawMimeString(email, privateKey, passphrase);
    }
    console.log(mimeMessage);

    let message = await this.gmailApiService.importMail(identity, mimeMessage);
    if(!message){
      return undefined;
    }

    if(message && !labelName){
      return message;
    }

    let labels = await this.gmailApiService.getLabels(identity);

    let label = labels?.find(l => l.name === labelName);

    if(label === undefined){
      label = await this.gmailApiService.createLabel(identity, labelName);
    }   

    if(label !== undefined){
      await this.gmailApiService.modifyMailLabels(identity, message.id, [ label ]);
    }

    return message;
  }

  /**
   * load all private keys of a gmail identity
   * @param identity 
   * @returns 
   */
  private async loadPrivateKeys(identity: Identity): Promise<OnlinePrivateKey[]>{
    let listMailResult = await this.gmailApiService.listMails(identity, `label:${this.privateKeyLabelName}`);
    let privateKeys : OnlinePrivateKey[] = [];
    if(!listMailResult){
      return [];
    }
    for (let mail of listMailResult.messages){
      let message = await this.gmailApiService.getMessage(identity, mail.id);
      if(message?.raw){
        let parsedMimeMessage = this.emailService.decodeAndParseMimeMessage(message.raw);
        let privateKeyAttachment = parsedMimeMessage.payload.attachments.filter(a => a.name === this.privateKeyAttachmentFileName);
        for(let attachment of privateKeyAttachment){
          let privateKey = await openpgp.readPrivateKey({ armoredKey: attachment.decodedText() })
          privateKeys.push({identity, messageId: mail.id, privateKey, mimeMessage: parsedMimeMessage});
        }
      }
    }
    return privateKeys;
  }

  /**
   * Load the trusted public keys of a gmail identity
   * @param identity 
   * @returns 
   */
   private async loadPublicKeyOwnerships(identity: Identity) : Promise<PublicKeyOwnershipExtended[]>{
    let listMailsResult = await this.gmailApiService.listMails(identity, `label:${this.publicKeyLabelName}`);
    let publicKeyOwnerships: PublicKeyOwnershipExtended[] = [];
    if(!listMailsResult){
      return [];
    }
    for(let mail of listMailsResult.messages){
      let message = await this.gmailApiService.getMessage(identity, mail.id);
      if(message?.raw){
        let parsedMimeMessage = this.emailService.decodeAndParseMimeMessage(message.raw);
        publicKeyOwnerships.push({ 
          identity: identity, 
          messageId: mail.id,
          mimeMessage: parsedMimeMessage,
        });
      }
    }
    return publicKeyOwnerships;
  }

  /**
   * Load the trustworty ict issuer of a identity
   * @param identity 
   * @returns 
   */
  private async loadTrustworthyIctIssuers(identity: Identity) : Promise<TrustworthyIctIssuerExtended[]>{
    let listMailsResult = await this.gmailApiService.listMails(identity, `label:${this.trustworthyIctIssuerLabelName}`);
    let trustworthyIctIssuers: TrustworthyIctIssuerExtended[] = [];
    if(!listMailsResult){
      return [];
    }
    for(let mail of listMailsResult.messages){
      let message = await this.gmailApiService.getMessage(identity, mail.id);
      if(message?.raw){
        let parsedMimeMessage = this.emailService.decodeAndParseMimeMessage(message.raw);
        let trustworthyIssuerAttachments = parsedMimeMessage.payload.attachments.filter(a => a.name === this.trustworthyIctIssuerAttachmentFileName);
        for(let attachment of trustworthyIssuerAttachments){
          trustworthyIctIssuers.push({ 
            identity: identity, 
            issuer: attachment.decodedText().trim(), 
            messageId: mail.id,
            mimeMessage: parsedMimeMessage,
          });
        }
      }
    }
    return trustworthyIctIssuers;
  }
}
