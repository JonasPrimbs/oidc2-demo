import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Identity, IdentityService } from 'src/app/modules/authentication';

import { MimeMessage } from '../../classes/mime-message/mime-message';
import { EmailService } from '../../services/email/email.service';
import { Oidc2VerificationService } from '../../services/oidc2-verification/oidc2-verification.service';
import { PgpService } from '../../services/pgp/pgp.service';
import { MimeMessageSecurityResult } from '../../types/mime-message-security-result.interface';
import { Oidc2IdentityVerificationResult } from '../../types/oidc2-identity-verification-result.interface';

@Component({
  selector: 'app-email-view',
  templateUrl: './email-view.component.html',
  styleUrls: ['./email-view.component.scss']
})
export class EmailViewComponent {

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
    private readonly oidc2VerificationService: Oidc2VerificationService,
  )
  { 
    this.identityService.identitiesChanged.subscribe(() => this.selectDefaultGoogleIdentityOnIdentitiesChanged());
    this.oidc2VerificationService.trustworthyIssuersChanged.subscribe(() => this.evaluateMimeMessageSecurity());
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
      this.mimeMessageSecurity = await this.pgpService.checkMimeMessageSecurity(this.originMimeMessage, this.selectedIdentity.controls.identity.value);
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
    for(let signature of securityResult.signatureVerificationResults){
      if(!signature.oidc2Identity || !signature.signatureVerified){
        return false;
      }
    }
    return true;
  }

  public get disabledSaveTrustfullPublicKey (){
    return !this.selectedIdentity.controls.identity.value || !this.mimeMessageSecurity || !this.mimeMessageSecurity.publicKey || !this.allSignaturesValid(this.mimeMessageSecurity);
  } 

  /**
   * save the public key as trustful public key
   */
  public saveTrustfulPublicKey(){
    let senderMail = this.mimeMessageSecurity?.oidc2VerificationResults.find(id => id.ictVerified && id.popVerified && id.identity?.email)?.identity?.email;
    if(!this.disabledSaveTrustfullPublicKey && senderMail){
      this.pgpService.savePublicKey(this.selectedIdentity.controls.identity.value!, this.mimeMessageSecurity?.publicKey!, senderMail!);
    }
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
  public trustIctIssuer(oidc2VerificationResult: Oidc2IdentityVerificationResult){
    if(this.canTrustIctIssuer(oidc2VerificationResult)){
      this.oidc2VerificationService.trustIssuer(this.selectedIdentity.controls.identity.value!, oidc2VerificationResult.identity?.issuer!);
    }
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
}
