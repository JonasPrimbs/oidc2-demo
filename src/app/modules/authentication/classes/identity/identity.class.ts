import { EventEmitter } from '@angular/core';

import { IdentityClaims } from '../../types/identity-claims.interface';
import { IdentityProvider } from '../identity-provider/identity-provider.class';

export class Identity {
  /**
   * Gets an unmodifiable instance of claims.
   */
  public get claims(): Partial<IdentityClaims> {
    return JSON.parse(JSON.stringify(this._claims));
  }

  /**
   * Notifies about a logout.
   */
  public readonly onLogout = new EventEmitter<void>();

  /**
   * Constructs a new Identity.
   * @param _claims Identity claims.
   * @param identityProvider Identity provider.
   * @param accessToken OAuth 2 Access Token.
   * @param accessTokenExpiry Expiration Date of the OAuth 2 Access Token.
   * @param refreshToken OAuth 2 Refresh Token.
   */
  constructor(
    private readonly _claims: Partial<IdentityClaims>,
    public readonly identityProvider: IdentityProvider,
    private readonly accessToken?: string,
    private readonly accessTokenExpiry?: Date,
    private readonly refreshToken?: string,
  ) { }

  /**
   * Performs a logout.
   */
  public async logout(): Promise<void> {
    this.onLogout.emit();
  }
}
