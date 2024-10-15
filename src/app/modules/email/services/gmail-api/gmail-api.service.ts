import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { Identity } from "src/app/modules/authentication";
import { AttachmentFile } from "../../classes/attachment-file/attachment-file";
import { Email } from "../../classes/email/email";
import { decodeAndParseMimeMessage, MimeMessage } from "../../classes/mime-message/mime-message";
import { PublicKeyOwnership, PublicKeyOwnershipExtended } from "../../types/public-key-ownership.interface";
import { TrustworthyIctIssuer, TrustworthyIctIssuerExtended } from "../../types/trustworthy-ict-issuer";

import * as openpgp from 'openpgp';
import { OnlinePrivateKey as OnlinePrivateKey } from "../../types/online-private-key.interface";
import { PgpKeyCertificationService } from "../pgp-key-certification/pgp-key-certification.service";
import { EmailContent } from "../../classes/email-content/email-content";

@Injectable({
  providedIn: 'root',
})
export class GmailApiService {

  readonly privateKeyLabelName = "PRIVATE_KEY";
  readonly publicKeyLabelName = "PUBLIC_KEY";
  readonly trustworthyIctIssuerLabelName = "TRUSTWORTHY_ICT_ISSUER";

  public readonly publicKeyAttachmentFileName = "public_key.asc";
  public readonly privateKeyAttachmentFileName = "private_key.asc";
  public readonly trustworthyIctIssuerAttachmentFileName = "trustworthy_ict_issuer.txt";

  constructor(
    private readonly http: HttpClient,
    private readonly oidc2AttachmentService: PgpKeyCertificationService,
  ){}

  /**
   * Get all labels 
   * @param identity 
   * @returns 
   */
  public async getLabels(identity: Identity): Promise<LabelResult[] | undefined>{
    let result = await firstValueFrom(this.http.get<{labels: LabelResult[]}>(`https://gmail.googleapis.com/gmail/v1/users/${identity.claims.email}/labels`, 
      {
        headers: {
          'Authorization': `Bearer ${identity.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
    return result.labels;
  }

  /**
   * Create a new label
   * @param identity 
   * @param name 
   * @param labelListVisibility 
   * @param messageListVisibility 
   * @returns 
   */
  public async createLabel(identity: Identity, name: string, labelListVisibility = "labelHide", messageListVisibility = "hide"): Promise<LabelResult | undefined>{
    let label = await firstValueFrom(this.http.post<LabelResult>(`https://gmail.googleapis.com/gmail/v1/users/${identity.claims.email}/labels`, 
      { 
        name,
        labelListVisibility,
        messageListVisibility
      },
      {
        headers: {
          'Authorization': `Bearer ${identity.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
    return label;
  }

  /**
   * Modify the labels of a message
   * @param identitiy 
   * @param mailId 
   * @param labelsToAdd 
   * @param labelsToRemove 
   * @returns 
   */
  public async modifyMailLabels(identitiy: Identity, mailId: string, labelsToAdd: LabelResult[] = [], labelsToRemove: LabelResult[] = []): Promise<MessageResult | undefined>{
    let body = {
      addLabelIds: labelsToAdd.map(l => l.id),
      removeLabelIds: labelsToRemove.map(l => l.id),
    }

    let message = await firstValueFrom(this.http.post<MessageResult>(
      `https://www.googleapis.com/gmail/v1/users/${identitiy.claims.email}/messages/${mailId}/modify`,
      body,
      {
        headers: {
          'Authorization': `Bearer ${identitiy.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
    return message;
  }

  /**
   * Import a mime-message without sending (like receiving a self defined message)
   * @param identity 
   * @param mimeContent 
   * @returns 
   */
  public async importMail(identity: Identity, mimeContent: string): Promise<MessageResult | undefined>{
    let message = await firstValueFrom(this.http.post<MessageResult>(
      `https://www.googleapis.com/gmail/v1/users/${identity.claims.email}/messages/import?uploadType=multipart&format=raw`,
      { raw: mimeContent },
      {
        headers: {
          'Authorization': `Bearer ${identity.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
    return message;
  }

  /**
   * Send a mime-message 
   * @param identity 
   * @param mimeContent 
   * @returns 
   */
   public async sendMail(identity: Identity, mimeContent: string): Promise<MessageResult | undefined>{
    try{
      let message = await firstValueFrom(this.http.post<MessageResult>(
        `https://www.googleapis.com/gmail/v1/users/${identity.claims.email}/messages/send?uploadType=multipart&format=raw`,
        { raw: mimeContent },
        {
          headers: {
            'Authorization': `Bearer ${identity.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      ));
      return message;
    }
    catch(err){
      return undefined;
    }
  }

  /**
   * List all mails for a given query
   * @param identity 
   * @param query 
   * @returns 
   */
  public async listMails(identity: Identity, query = "in:inbox"): Promise<ListMailResult|undefined>{
    try{
      var result = await firstValueFrom(this.http.get<ListMailResult|undefined>(
        `https://www.googleapis.com/gmail/v1/users/${identity.claims.email}/messages?q=${query}`,
        {
          headers: {
            'Authorization': `Bearer ${identity.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      ));
      return result
    }
    catch(err){
      return undefined;
    }    
  }

  /**
   * Get a message by id
   * @param identity 
   * @param messageId 
   * @returns 
   */
  public async getMessage(identity: Identity, messageId: string): Promise<MessageResult | undefined>{
    var result = await firstValueFrom(this.http.get<MessageResult>(
      `https://www.googleapis.com/gmail/v1/users/${identity.claims.email}/messages/${messageId}?format=raw`,
      {
        headers: {
          'Authorization': `Bearer ${identity.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
    return result;
  }

  /**
   * Delete a message by id
   * @param identity 
   * @param messageId 
   * @returns 
   */
  public async deleteMesage(identity: Identity, messageId: string): Promise<void>{
    await firstValueFrom(this.http.delete<Record<string,any>>(
      `https://www.googleapis.com/gmail/v1/users/${identity.claims.email}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${identity.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
  }

  /**
   * saves attachment-file data to a mail with a specific label
   * @param identity 
   * @param subject 
   * @param attachments 
   * @param labelName 
   * @returns 
   */
  public async saveData(identity: Identity, subject: string, attachments: AttachmentFile[], labelName: string, ictIdentity: Identity, privateKey: openpgp.PrivateKey, passphrase: string, explanation: string, encrypted: boolean = false): Promise<MessageResult | undefined>{    
    let emailBody = new EmailContent(explanation);
    const email = new Email(identity, identity.claims.email ?? "", subject, [emailBody, ...attachments]);

    const ictPopAttachments = await this.oidc2AttachmentService.generateIctPopAttachments([ictIdentity], email.receiver, privateKey);

    ictPopAttachments.forEach(a => email.parts.push(a));

    let mimeMessage: string = "";
    if(encrypted){
      let encryptionKey = await openpgp.decryptKey({privateKey, passphrase});      
      mimeMessage = await email.toRawEncryptedMimeString([encryptionKey], privateKey, passphrase)
    }
    else{
      mimeMessage = await email.toRawMimeString(privateKey, passphrase);
    }
    console.log(mimeMessage);

    let message = await this.importMail(identity, mimeMessage);
    if(!message){
      return undefined;
    }

    if(message && !labelName){
      return message;
    }

    let labels = await this.getLabels(identity);

    let label = labels?.find(l => l.name === labelName);

    if(label === undefined){
      label = await this.createLabel(identity, labelName);
    }   

    if(label !== undefined){
      await this.modifyMailLabels(identity, message.id, [ label ]);
    }

    return message;
  }


  /**
   * save the private key of a gmail identity
   * @param identity 
   * @param attachment 
   */
  public async savePrivateKey(identity: Identity, ictIdentity: Identity, privateKey: openpgp.PrivateKey, passphrase: string): Promise<string|undefined> { 
    let explanation = `The attachment ${this.privateKeyAttachmentFileName} contains your encrypted private key with the KeyId 0x${ privateKey.getKeyID().toHex().toUpperCase() }.
    After deleting this mail you can neither decrypt nor sign mails with this private key.`;
    const attachment = new AttachmentFile(this.privateKeyAttachmentFileName, privateKey.armor(), "text/plain");    
    let message = await this.saveData(identity, "private_key", [attachment], this.privateKeyLabelName, ictIdentity, privateKey, passphrase, explanation);
    return message?.id;
  }

  /**
   * load all private keys of a gmail identity
   * @param identity 
   * @returns 
   */
  public async loadPrivateKeys(identity: Identity): Promise<OnlinePrivateKey[]>{
    let listMailResult = await this.listMails(identity, `label:${this.privateKeyLabelName}`);
    let privateKeys : OnlinePrivateKey[] = [];
    if(!listMailResult){
      return [];
    }
    for (let mail of listMailResult.messages){
      let message = await this.getMessage(identity, mail.id);
      if(message?.raw){
        let parsedMimeMessage = decodeAndParseMimeMessage(message.raw);
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
   * save the public key into gmail
   * @param identity 
   * @param attachment 
   * @param sender 
   * @returns 
   */
  public async savePublicKey(identity: Identity, publicKey: openpgp.PublicKey, sender: string, ictIdentity: Identity, privateKey: openpgp.PrivateKey, passphrase: string) : Promise<string | undefined>{
    let explanation = `The attachment ${this.publicKeyAttachmentFileName} contains the PGP-public-key of ${sender}. 
    After deleting this mail you can't encrypt a mail for ${sender} with the Key 0x${publicKey.getKeyID().toHex().toUpperCase()}.`;
    const attachment = new AttachmentFile(this.publicKeyAttachmentFileName, publicKey.armor(), "text/plain");
    let message = await this.saveData(identity, sender, [attachment], this.publicKeyLabelName, ictIdentity, privateKey, passphrase, explanation, true);
    console.log(message);
    return message?.id;
  }

  /**
   * Load the trusted public keys of a gmail identity
   * @param identity 
   * @returns 
   */
   public async loadPublicKeyOwnerships(identity: Identity) : Promise<PublicKeyOwnershipExtended[]>{
    let listMailsResult = await this.listMails(identity, `label:${this.publicKeyLabelName}`);
    let publicKeyOwnerships: PublicKeyOwnershipExtended[] = [];
    if(!listMailsResult){
      return [];
    }
    for(let mail of listMailsResult.messages){
      let message = await this.getMessage(identity, mail.id);
      if(message?.raw){
        let parsedMimeMessage = decodeAndParseMimeMessage(message.raw);
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
   * save a trustworthy ict issuer to gmail
   * @param identity 
   * @param issuer 
   * @returns 
   */
  public async saveTrustworthyIctIssuer(identity: Identity, issuer: string, ictIdentity: Identity, privateKey: openpgp.PrivateKey, passphrase: string) : Promise<string | undefined> {
    let explanation = `the attachment ${this.trustworthyIctIssuerAttachmentFileName} contains your trust into the ICT-issuer ${issuer}.
    After deleting this mail you revoke your trust into the ICT issuer.`;
    let attachment = new AttachmentFile(this.trustworthyIctIssuerAttachmentFileName, issuer, "text/plain", "trustworthy_ict_issuer");
    let message = await this.saveData(identity, "ict_issuer", [ attachment ], this.trustworthyIctIssuerLabelName, ictIdentity, privateKey, passphrase, explanation);
    return message?.id;
  }

  /**
   * Load the trustworty ict issuer of a identity
   * @param identity 
   * @returns 
   */
  public async loadTrustworthyIctIssuers(identity: Identity) : Promise<TrustworthyIctIssuerExtended[]>{
    let listMailsResult = await this.listMails(identity, `label:${this.trustworthyIctIssuerLabelName}`);
    let trustworthyIctIssuers: TrustworthyIctIssuerExtended[] = [];
    if(!listMailsResult){
      return [];
    }
    for(let mail of listMailsResult.messages){
      let message = await this.getMessage(identity, mail.id);
      if(message?.raw){
        let parsedMimeMessage = decodeAndParseMimeMessage(message.raw);
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

export interface ListMailResult{
  readonly messages: MessageResult[];
  readonly nextPageToken: string,
  readonly resultSizeEstimate: number,
}

export interface LabelResult{
  readonly id: string;
  readonly name: string;
  readonly labelListVisibility: string;
  readonly messageListVisibility: string;
  readonly type: string;
}

export interface MessageResult{ 
  readonly id: string;
  readonly snippet?: string,
  readonly historyId?: string,
  readonly internalDate?: string,
  readonly threadid?: string;
  readonly labelIds?: string[];
  readonly sizeEstimate?: number,
  readonly raw?: string;
}