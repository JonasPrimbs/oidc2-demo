import { Component } from '@angular/core';

import { Identity, IdentityService } from 'src/app/modules/authentication';
import { FormControl, FormGroup } from '@angular/forms';
import { Oidc2VerificationService } from '../../services/pgp-key-authentication/pgp-key-authentication.service';
import { _MatListItemGraphicBase } from '@angular/material/list';
import { TrustworthyIctIssuer, TrustworthyIctIssuerExtended } from '../../types/trustworthy-ict-issuer';
import { SynchronizationService } from '../../services/synchronization/synchronization.service';

@Component({
  selector: 'app-trustworthy-ict-issuer-manage',
  templateUrl: './trustworthy-ict-issuer-manage.component.html',
  styleUrls: ['./trustworthy-ict-issuer-manage.component.scss'],
})
export class TrustworthyIctIssueManageComponent {
  
  /**
   * Constructs a new PGP Load Component.
   * @param pgpService PGP Service instance.
   * @param identityService Identity Service instance.
   */
  constructor(
    private readonly identityService: IdentityService,
    private readonly oidc2VerivicationService: Oidc2VerificationService,
    private readonly dataService: SynchronizationService,
  ) 
  {
    this.oidc2VerivicationService.trustworthyIssuersChanged.subscribe(() => this.reloadTrustwortyIssuers());
  }

  /**
   * Gets the available google identities.
   */
   public get identities(): Identity[] {
    return this.identityService.identities.filter(i => i.hasGoogleIdentityProvider);
  }

  
  /**
   * the trust ict issuer form group
   */
  public readonly trustIctIssuer = new FormGroup({
    identity: new FormControl<Identity | undefined>(undefined),
    issuer: new FormControl<string>(''),
  });
  
  /**
   * the trustworthy ict issuers
   */
  public trustworthyIctIssuers: TrustworthyIctIssuer[] = [];

  /**
   * initial untrusted ict issuers
   */
  public get untrustedIctIssuers(): TrustworthyIctIssuerExtended[]{
    return this.dataService.untrustedIctIssuers;
  }
  
  /**
   * displayed columns of the trustworthy ict issuers table
   */
  public displayedColumns: string[] = ['identity', 'issuer', 'delete'];

  /**
   * trust an issuer
   */
   public async trustUntrustedIctIssuer(untrustedIctIssuer: TrustworthyIctIssuerExtended){
    this.dataService.trustUntrustedIssuer(untrustedIctIssuer);
  }

  /**
   * untrust an issuer
   * @param untrust 
   */
  public async untrust(untrust: TrustworthyIctIssuer){
    await this.dataService.deleteTrustIssuer(untrust);
  }

  /**
   * reload trustworthy issuers on trustworthy issuers changed
   */
  private reloadTrustwortyIssuers(){
    this.trustworthyIctIssuers = this.oidc2VerivicationService.trustworthyIssuers;
  }
}
