import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { decodeBase64url } from 'src/app/byte-array-converter/base64url';

import { Identity, IdentityService } from '../../../authentication';
import { Email } from '../../classes/email/email';
import { EmailMessage, parseEmailMessage } from '../../classes/email/message';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  /**
   * Gets a list of identities which are sufficient to send emails via Google Mail.
   */
  public get senderIdentities(): Identity[] {
    return this.identityService.identities.filter(
      id => (id.scopes?.indexOf('https://www.googleapis.com/auth/gmail.send') ?? -1) >= 0 && id.claims.email,
    );
  }

  /**
   * Constructs a new Email Service instance.
   * @param identityService Identity Service instance.
   * @param http HTTP Client instance.
   */
  constructor(
    private readonly identityService: IdentityService,
    private readonly http: HttpClient,
  ) { }


  public async readEmail(mailIndex: number): Promise<EmailMessage|undefined>{

    // find a identity
    var identity = this.identityService.identities.find(id => id.scopes?.indexOf('https://www.googleapis.com/auth/gmail.readonly'))
    if(identity == undefined){
      return undefined;
    }

    // query the latest message id
    //'https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox'
    var ids = await firstValueFrom(this.http.get<Record<string, any>>(
      `https://www.googleapis.com/gmail/v1/users/${identity.claims.email}/messages?q=in:inbox`,
      {
        headers: {
          'Authorization': `Bearer ${identity.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
    console.log(identity.accessToken);

    // get the message by id
    // https://gmail.googleapis.com/gmail/v1/users/{userId}/messages/{id}
    var result = await firstValueFrom(this.http.get<Record<string, any>>(
      `https://www.googleapis.com/gmail/v1/users/${identity.claims.email}/messages/${ids['messages'][mailIndex].id}?format=raw`,
      {
        headers: {
          'Authorization': `Bearer ${identity.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));

    let base64urlEmail = result['raw'];
    let decodedEmail = decodeBase64url(base64urlEmail);
    
    let decoder = new TextDecoder();
    let mimeMessage = decoder.decode(decodedEmail);
    
    let emailMessage = parseEmailMessage(mimeMessage);
    return emailMessage;
  }

  /**
   * Sends an email.
   * @param email Email to send.
   */
  public async sendEmail(email: Email): Promise<void> {
    console.log(email.sender);
    await firstValueFrom(this.http.post<Record<string, any>>(
      `https://www.googleapis.com/gmail/v1/users/${email.sender.claims.email}/messages/send?uploadType=multipart`,
      { raw: await email.toRawString() },
      {
        headers: {
          'Authorization': `Bearer ${email.sender.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ));
  }
}
