import { Component } from '@angular/core';

import { Identity, IdentityService } from '../../../authentication';

@Component({
  selector: 'app-email',
  templateUrl: './email.component.html',
  styleUrls: ['./email.component.scss']
})
export class EmailComponent {
  get identities(): Identity[] {
    return this.identityService.identities;
  }

  constructor(
    private readonly identityService: IdentityService,
  ) { }

  public async test(identity: Identity): Promise<void> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-384',
      },
      false,
      ['sign', 'verify'],
    );

    const ict = await this.identityService.requestIct(identity, keyPair, ['name', 'email']);
  }
}
