import { Component } from '@angular/core';

import { Identity } from '../../classes/identity/identity.class';
import { IdentityService } from '../../services/identity/identity.service';
import { IdentityProvider } from '../../classes/identity-provider/identity-provider.class';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  /**
   * Array of identities from identity service.
   */
  public get identities(): Identity[] {
    return this.identityService.identities;
  }

  /**
   * Array of identity providers from identity service.
   */
  public get identityProviders(): IdentityProvider[] {
    return this.identityService.identityProviders;
  }

  /**
   * Constructs a new App Component.
   * @param identityService The identity service instance.
   */
  constructor(
    private readonly identityService: IdentityService,
  ) { }

  /**
   * Performs a login of the user.
   * @param identityProvider Selected identity provider.
   */
  public async login(identityProvider: IdentityProvider): Promise<void> {
    await this.identityService.login(identityProvider);
  }
}
