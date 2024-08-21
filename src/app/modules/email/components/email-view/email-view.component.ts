import { Component } from '@angular/core';

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
  ){    
    } 

    public async loadMail() : Promise<void>{
      this.showSecurityInfo = false; 
      this.mimeMessageSecurity = undefined;
      this.mimeMessage = await this.emailService.readEmail(this.mailIndex);

      if(this.mimeMessage){
        this.mimeMessageSecurity = await this.pgpService.checkMimeMessageSecurity(this.mimeMessage);
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
