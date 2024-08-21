import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Identity, IdentityService } from 'src/app/modules/authentication';

import { MimeMessage } from '../../classes/mime-message/mime-message';
import { EmailService } from '../../services/email/email.service';
import { PgpService } from '../../services/pgp/pgp.service';
import { MimeMessageSecurityResult } from '../../types/mime-message-security-result.interface';

@Component({
  selector: 'app-email-view',
  templateUrl: './email-view.component.html',
  styleUrls: ['./email-view.component.scss']
})
export class EmailViewComponent {

  private mailIndex: number = 0;
  public mimeMessage: MimeMessage | undefined;  
  public mimeMessageSecurity : MimeMessageSecurityResult | undefined;
  public showSecurityInfo : boolean = false;

  public get disabledNext (){
    return this.mailIndex <= 0;
  } 

  constructor(
    private readonly emailService: EmailService,
    private readonly pgpService: PgpService,
    private readonly identityService: IdentityService,
  )
  { 

  } 

  /**
    * Gets the available google identities.
    */
  public get identities(): Identity[] {
    return this.identityService.identities.filter(i => i.identityProvider.name === "Google");
  }

  /**
    * Form Group to import PGP Key File.
    */
  public readonly selectedIdentity = new FormGroup({
    identity: new FormControl<Identity | undefined>(undefined),
  });
  


    public async loadMail() : Promise<void>{
      if(!this.selectedIdentity.controls.identity.value){
        return;
      }

      this.showSecurityInfo = false; 
      this.mimeMessageSecurity = undefined;
      this.mimeMessage = await this.emailService.readEmail(this.mailIndex, this.selectedIdentity.controls.identity.value);

      if(this.mimeMessage){
        this.mimeMessageSecurity = await this.pgpService.checkMimeMessageSecurity(this.mimeMessage, this.selectedIdentity.controls.identity.value);
        this.mimeMessage = this.mimeMessageSecurity.clearetextMimeMessage;
      }
    }
    
    public async next(): Promise<void>{
      this.mailIndex--;
      await this.loadMail();
    }   

    public async previous(): Promise<void>{
      this.mailIndex++;
      await this.loadMail();
    }   

    public toggleSecurityInfo(){
      this.showSecurityInfo = !this.showSecurityInfo;
    }

    public allSignaturesValid(securityResult: MimeMessageSecurityResult) : boolean{
      for(let signature of securityResult.signatureVerificationResults){
        if(!signature.oidc2Identity || !signature.signatureVerified){
          return false;
        }
      }
      return true;
    }
  }
