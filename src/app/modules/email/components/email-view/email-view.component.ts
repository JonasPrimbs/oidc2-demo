import { Component } from '@angular/core';
import { Signature } from 'jose';
import { PacketList, PublicKey, SignaturePacket, VerificationResult } from 'openpgp';
import { Identity, IdentityProvider } from 'src/app/modules/authentication';
import { EmailContent } from '../../classes/email-content/email-content';
import { Email } from '../../classes/email/email';
import { parseMimeMessagePart } from '../../classes/mime-message-part/mime-message-part';
import { MimeMessage, parseMimeMessage } from '../../classes/mime-message/mime-message';
import { EmailService } from '../../services/email/email.service';
import { PgpService, SignatureVerificationResult } from '../../services/pgp/pgp.service';

@Component({
  selector: 'app-email-view',
  templateUrl: './email-view.component.html',
  styleUrls: ['./email-view.component.scss']
})
export class EmailViewComponent {

  private mailIndex: number = 0;

  public email: MimeMessage | undefined;
  
  public publicKey: PublicKey | undefined;

  public signatureResults : SignatureVerificationResult[] = [];

  public encrypted : boolean = false;;

  public get disabledNext (){
    return this.mailIndex <= 0;
  } 

  constructor(
    private readonly emailService: EmailService,
    private readonly pgpService: PgpService
  ){    
    } 

    public async loadMail() : Promise<void>{
      this.publicKey = undefined;
      this.signatureResults = [];
      this.encrypted = false;
      this.email = await this.emailService.readEmail(this.mailIndex);
      
      
      if(this.email?.payload.encryptedContent() !== undefined){
        let res = await this.pgpService.decryptAndVerifyMimeMessage(this.email);
        if(res){
          this.email = res.mimeMessage;
          this.signatureResults = res.signatureVerificationResults;
          this.encrypted = true;
        }
      }      
      if(this.email?.payload.signedContent() !== undefined){
        this.signatureResults = await this.pgpService.verifyMimeMessage(this.email);
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
    
  }

  

