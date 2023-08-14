import { Injectable } from '@angular/core';

import { Identity, IdentityService } from '../../../authentication';
import { Email } from '../../classes/email/email';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  public get senderIdentities(): Identity[] {
    return this.identityService.identities.filter(
      id => (id.scopes?.indexOf('https://mail.google.com/') ?? -1) >= 0,
    );
  }

  constructor(
    private readonly identityService: IdentityService,
  ) { }

  public async sendEmail(email: Email): Promise<void> {

  }
}
