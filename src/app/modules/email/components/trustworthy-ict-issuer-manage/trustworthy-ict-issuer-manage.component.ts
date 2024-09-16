import { Component } from '@angular/core';

import * as openpgp from 'openpgp';

import { Identity, IdentityService } from 'src/app/modules/authentication';
import { FormControl, FormGroup } from '@angular/forms';
import { Oidc2VerificationService } from '../../services/oidc2-verification/oidc2-verification.service';
import { _MatListItemGraphicBase } from '@angular/material/list';
import { TrustworthyIctIssuer } from '../../types/trustworthy-ict-issuer';
import { PgpService } from '../../services/pgp/pgp.service';
import { DataService } from '../../services/data/data.service';

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
    private readonly pgpService: PgpService,
    private readonly dataService: DataService,
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
   * displayed columns of the trustworthy ict issuers table
   */
  public displayedColumns: string[] = ['identity', 'issuer', 'delete'];

  /**
   * trust an issuer
   */
  public async trust(){
    if(this.trustIctIssuer.controls.identity.value && this.trustIctIssuer.controls.issuer.value){
      await this.dataService.trustIctIssuer(this.trustIctIssuer.controls.identity.value, this.trustIctIssuer.controls.issuer.value);
      this.trustIctIssuer.controls.issuer.setValue("");
    }
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
