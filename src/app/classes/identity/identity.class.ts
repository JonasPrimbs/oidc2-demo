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
   */
  constructor(
    private readonly _claims: Partial<IdentityClaims>,
    public readonly identityProvider: IdentityProvider,
  ) { }

  /**
   * Performs a logout.
   */
  public async logout(): Promise<void> {
    this.onLogout.emit();
  }
}
