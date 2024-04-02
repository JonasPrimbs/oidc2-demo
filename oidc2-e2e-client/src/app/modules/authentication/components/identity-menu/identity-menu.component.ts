import { Component, Input } from '@angular/core';

import { Identity } from '../../classes/identity/identity.class';

@Component({
  selector: 'identity-menu',
  templateUrl: './identity-menu.component.html',
  styleUrls: ['./identity-menu.component.scss'],
})
export class IdentityMenuComponent {
  /**
   * The identity to represent.
   */
  @Input()
  public identity?: Identity;

  /**
   * Gets the name to display.
   */
  public get name(): string {
    if (!this.identity) {
      return 'Unknown identity';
    } else if (this.identity.claims.name) {
      return `${this.identity.claims.name} (${this.identity.identityProvider.name})`;
    } else {
      return `Unknown ${this.identity.identityProvider.name} user`;
    }
  }
}
