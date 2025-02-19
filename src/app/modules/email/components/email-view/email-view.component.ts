import { Component, inject } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Identity, IdentityService } from 'src/app/modules/authentication';

import { MimeMessage } from '../../classes/mime-message/mime-message';
import { SynchronizationService } from '../../services/synchronization/synchronization.service';
import { EmailService } from '../../services/email/email.service';
import { PgpKeyAuthenticationService } from '../../services/pgp-key-authentication/pgp-key-authentication.service';
import { PgpService } from '../../services/pgp/pgp.service';
import { MimeMessageSecurityResult } from '../../types/mime-message-security-result.interface';
import { Oidc2IdentityVerificationResult } from '../../types/oidc2-identity-verification-result.interface';

@Component({
  selector: 'app-email-view',
  templateUrl: './email-view.component.html',
  styleUrls: ['./email-view.component.scss']
})
export class EmailViewComponent {

  /**
   * The MatSnackBar Object
   */
  private snackBar = inject(MatSnackBar);

  private mailIndex: number = 0;

  public mimeMessage: MimeMessage | undefined;
  public originMimeMessage: MimeMessage | undefined;
  public mimeMessageSecurity : MimeMessageSecurityResult | undefined;
  public showSecurityInfo : boolean = false;

  public get disabledNext (){
    return this.mailIndex <= 0;
  } 

  constructor(
    private readonly emailService: EmailService,
    private readonly pgpService: PgpService,
    private readonly identityService: IdentityService,
    private readonly pgpKeyAuthenticationService: PgpKeyAuthenticationService,
    private readonly dataService: SynchronizationService,
  )
  { 
    this.identityService.identitiesChanged.subscribe(() => this.selectDefaultGoogleIdentityOnIdentitiesChanged());
    this.pgpKeyAuthenticationService.trustworthyIssuersChanged.subscribe(() => this.evaluateMimeMessageSecurity());
    this.pgpService.privateKeysChanged.subscribe(() => this.evaluateMimeMessageSecurity());
    this.selectedIdentity.controls.identity.valueChanges.subscribe(() => this.onUserChanges());
  } 

  /**
    * Gets the available google identities.
    */
  public get identities(): Identity[] {
    return this.identityService.identities.filter(i => i.hasGoogleIdentityProvider);
  }

  /**
    * Form Group to import PGP Key File.
    */
  public readonly selectedIdentity = new FormGroup({
    identity: new FormControl<Identity | undefined>(undefined),
  });
  
  /**
   * load the mail with the current mail-index
   * @returns 
   */
  public async loadMail() : Promise<void>{
    if(!this.selectedIdentity.controls.identity.value){
      return;
    }
    this.showSecurityInfo = false; 
    this.mimeMessageSecurity = undefined;
    this.originMimeMessage = await this.emailService.readEmail(this.mailIndex, this.selectedIdentity.controls.identity.value);
    this.mimeMessage = this.originMimeMessage;
    this.evaluateMimeMessageSecurity();
  }

  /**
   * evaluates the mime message security for the current selected originMimeMessage
   */
  public async evaluateMimeMessageSecurity(): Promise<void> {
    if(this.originMimeMessage && this.selectedIdentity.controls.identity.value){
      this.mimeMessageSecurity = await this.pgpKeyAuthenticationService.authenticatePgpKey(this.originMimeMessage, this.selectedIdentity.controls.identity.value);
      this.mimeMessage = this.mimeMessageSecurity.clearetextMimeMessage;
    }
  }

  /**
   * on user changes: load first mail in inbox
   */
  public async onUserChanges(){
    this.mailIndex = 0;
    await this.loadMail();
  }
  
  /**
   * move to the next mail
   */
  public async next(): Promise<void>{
    this.mailIndex--;
    await this.loadMail();
  }   

  /**
   * move to the previous mail
   */
  public async previous(): Promise<void>{
    this.mailIndex++;
    await this.loadMail();
  }   

  /**
   * toggle the security info 
   */
  public toggleSecurityInfo(){
    this.showSecurityInfo = !this.showSecurityInfo;
  }

  /**
   * determines wether all signatures or a security result are valid
   * @param securityResult 
   * @returns 
   */
  public allSignaturesValid(securityResult: MimeMessageSecurityResult) : boolean{
    return this.pgpService.signaturesAvailableAndValid(securityResult);
  }

  public get disabledSaveTrustfullPublicKey (){
    return !this.selectedIdentity.controls.identity.value || !this.mimeMessageSecurity || !this.mimeMessageSecurity.publicKey || !this.allSignaturesValid(this.mimeMessageSecurity);
  } 

  /**
   * save the public key as trustful public key
   */
  public async saveTrustfulPublicKey(){
    let identity = this.selectedIdentity.controls.identity.value!;
    let canStoreDataResult = this.dataService.canStoreData(identity);
    if(canStoreDataResult.canStoreData){
      let senderMail = this.mimeMessageSecurity?.oidc2VerificationResults.find(id => id.ictVerified && id.popVerified && id.identity?.email)?.identity?.email;
      if(!this.disabledSaveTrustfullPublicKey && senderMail){
        let res = await this.dataService.savePublicKey(identity, this.mimeMessageSecurity?.publicKey!, senderMail!);
        if(res){
          this.openSnackBar("public key stored");
          return;
        }
      }
    }
    this.openSnackBar(canStoreDataResult.errorMessage ?? "something went wrong");
  }

  /**
   * determines wether it is possible to trust the issuer of the ICT 
   * @param oidc2VerificationResult 
   * @returns 
   */
  public canTrustIctIssuer(oidc2VerificationResult: Oidc2IdentityVerificationResult): boolean{
    return this.selectedIdentity.controls.identity.value !== undefined && oidc2VerificationResult.identity?.issuer !== undefined;
  }

  /**
   * trust the issuer of the ICT
   * @param oidc2VerificationResult 
   */
  public async trustIctIssuer(oidc2VerificationResult: Oidc2IdentityVerificationResult){
    let identity = this.selectedIdentity.controls.identity.value!;
    let canStoreDataResult = this.dataService.canStoreData(identity);
    if(canStoreDataResult.canStoreData){
      if(this.canTrustIctIssuer(oidc2VerificationResult)){
        let res = await this.dataService.saveTrustIctIssuer(this.selectedIdentity.controls.identity.value!, oidc2VerificationResult.identity?.issuer!);
        if(res){
          this.openSnackBar("trustworthy ict issuer stored");
          return;
        }
      }
    }
    this.openSnackBar(canStoreDataResult.errorMessage ?? "something went wrong");       
  }

  /**
   * select the default google identity on identities changed
   */
  private async selectDefaultGoogleIdentityOnIdentitiesChanged(){
    if(!this.selectedIdentity.controls.identity.value && this.identities.length > 0){
      this.selectedIdentity.controls.identity.setValue(this.identities[0]);
    }
  }

  /**
   * copy text to the clipboard
   * @param text 
   */
  public copyToClipboard(text: string){
    navigator.clipboard.writeText(text);
  }

  /**
   * Shows a small message
   * @param message 
   */
   private openSnackBar(message: string) {
    this.snackBar.open(message);
  }
}
