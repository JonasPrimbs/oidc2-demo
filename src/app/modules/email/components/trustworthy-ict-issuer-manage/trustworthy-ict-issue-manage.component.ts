import { Component } from '@angular/core';

import * as openpgp from 'openpgp';

import { Identity, IdentityService } from 'src/app/modules/authentication';
import { GmailApiService } from '../../services/gmail-api/gmail-api.service';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { Oidc2VerificationService } from '../../services/oidc2-verification/oidc2-verification.service';
import { _MatListItemGraphicBase } from '@angular/material/list';
import { TrustworthyIctIssuer } from '../../types/trustworthy-ict-issuer';

@Component({
  selector: 'app-trustworthy-ict-issue-manage',
  templateUrl: './trustworthy-ict-issue-manage.component.html',
  styleUrls: ['./trustworthy-ict-issue-manage.component.scss'],
})
export class TrustworthyIctIssueManageComponent {
  
  /**
   * Constructs a new PGP Load Component.
   * @param pgpService PGP Service instance.
   * @param identityService Identity Service instance.
   */
  constructor(
    private readonly identityService: IdentityService,
    private readonly gmailApiService: GmailApiService,
    private readonly oidc2VerivicationService: Oidc2VerificationService,
  ) 
  {
    this.oidc2VerivicationService.trustworthyIssuersChanged.subscribe(() => this.reload());
    this.trustIctIssuer.controls.identity.valueChanges.subscribe(id => this.loadAllIssuers(id ?? undefined));
  }

  /**
   * Gets the available google identities.
   */
   public get identities(): Identity[] {
    return this.identityService.identities.filter(i => i.identityProvider.name === "Google");
  }

  // public privateKeys : openpgp.PrivateKey[] = [];

  /**
     * Form Group 
     */
  public readonly trustIctIssuer = new FormGroup({
    identity: new FormControl<Identity | undefined>(undefined),
    issuer: new FormControl<string>(''),
  });

  public trustworthyIctIssuers: TrustworthyIctIssuer[] = [];

  public reload(){
    this.trustworthyIctIssuers = this.oidc2VerivicationService.trustworthyIssuers;
    // console.log('reload');
  }

  public async trust(){
    if(this.trustIctIssuer.controls.identity.value && this.trustIctIssuer.controls.issuer.value){
      await this.oidc2VerivicationService.trustIssuer(this.trustIctIssuer.controls.identity.value, this.trustIctIssuer.controls.issuer.value);
      this.trustIctIssuer.controls.issuer.setValue("");
    }
  }

  public async untrust(untrust: TrustworthyIctIssuer){
    await this.oidc2VerivicationService.untrustIssuer(untrust);
  }

  public async loadAllIssuers(identity: Identity | undefined){
    if(identity){
      this.oidc2VerivicationService.loadAllIssuers(identity);
    }
  }

  
}
