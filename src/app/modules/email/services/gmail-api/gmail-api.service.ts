import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { Identity } from "src/app/modules/authentication";

@Injectable({
  providedIn: 'root',
})
export class GmailApiService {

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