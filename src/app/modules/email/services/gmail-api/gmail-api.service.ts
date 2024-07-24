import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { PrivateKey } from "openpgp";
import { firstValueFrom } from "rxjs";
import { Identity } from "src/app/modules/authentication";
import { AttachmentFile } from "../../classes/attachment-file/attachment-file";
import { Email } from "../../classes/email/email";

@Injectable({
  providedIn: 'root',
})
export class GmailApiService {

  readonly privateKeyLabelName = "PRIVATE_KEY";
  readonly publicKeyLabelName = "PUBLIC_KEY";

  constructor(
    private readonly http: HttpClient,
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

  /**
   * List all mails for a given query
   * @param identity 
   * @param query 
   * @returns 
   */
  public async listMails(identity: Identity, query = "in:inbox"): Promise<ListMailResult[]>{
    var result = await firstValueFrom(this.http.get<{messages: ListMailResult[]}>(
      `https://www.googleapis.com/gmail/v1/users/${identity.claims.email}/messages?q=${query}`,
      {
        headers: {
          'Authorization': `Bearer ${identity.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
    return result.messages;
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

  public async saveData(identity: Identity, subject: string, attachments: AttachmentFile[], labelName: string): Promise<MessageResult | undefined>{
    const email = new Email(identity, "", subject, attachments)
    
    const mimeMessage = await email.toRawMimeString();

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

  public async savePrivateKey(identity: Identity, attachment: AttachmentFile): Promise<void> {     
    let message = await this.saveData(identity, "private_key", [attachment], this.privateKeyLabelName);
    
    if(message === undefined){
      return;
    }

    
  }
}

export interface ListMailResult{
  readonly id: string;
  readonly threadId: string;
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
  readonly threadid?: string;
  readonly labelIds?: string[];
  readonly raw?: string;
}