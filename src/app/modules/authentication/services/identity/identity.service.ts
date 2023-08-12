import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Identity } from '../../classes/identity/identity.class';
import { IdentityProvider } from '../../classes/identity-provider/identity-provider.class';

@Injectable({
  providedIn: 'root',
})
export class IdentityService {
  /**
   * Internal array of identities.
   */
  private readonly _identities: Identity[] = [];
  /**
   * Gets an unmodifiable array of identities.
   */
  public get identities(): Identity[] {
    return [...this._identities];
  }

  /**
   * Internal array of identity providers.
   */
  private readonly _identityProviders: IdentityProvider[] = [
    new IdentityProvider(
      'Keycloak',
      'http://localhost:8080',
      'https://upload.wikimedia.org/wikipedia/commons/2/29/Keycloak_Logo.png'
    ),
  ];
  /**
   * Gets an unmodifiable array of identity providers.
   */
  public get identityProviders(): IdentityProvider[] {
    return [...this._identityProviders];
  }

  /**
   * Performs a login to an identity.
   * @param identityProvider Identity provider to login to.
   */
  public async login(identityProvider: IdentityProvider): Promise<Identity> {
    // TODO: Perform Login.

    // Create identity instance.
    const identity = new Identity(
      {
        name: 'John Smith',
        given_name: 'John',
        family_name: 'Smith',
      },
      identityProvider,
    );

    // Remove the identity instance from identities after logout.
    firstValueFrom(identity.onLogout).then(() => {
      const index = this._identities.indexOf(identity);
      this._identities.splice(index, 1);
    });
    // Add the identity to the array of identities.
    this._identities.push(identity);

    return identity;
  }
}
