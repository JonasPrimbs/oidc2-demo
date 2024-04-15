import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Identity, IdentityService } from '../../../authentication';
import { Email } from '../../classes/email/email';

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

  /**
   * Sends an email.
   * @param email Email to send.
   */
  public async sendEmail(email: Email): Promise<void> {
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
