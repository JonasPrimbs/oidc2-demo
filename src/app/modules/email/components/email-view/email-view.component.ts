import { Component } from '@angular/core';
import { Signature } from 'jose';
import { PacketList, PublicKey, SignaturePacket, VerificationResult } from 'openpgp';
import { Identity, IdentityProvider } from 'src/app/modules/authentication';
import { EmailContent } from '../../classes/email-content/email-content';
import { Email } from '../../classes/email/email';
import { MimeMessage } from '../../classes/mime-message/mime-message';
import { EmailService } from '../../services/email/email.service';
import { PgpService } from '../../services/pgp/pgp.service';

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

      this.email = await this.emailService.readEmail(this.mailIndex);
      let pgpKeyAttachment = this.email?.payload.attachments.find(a => a.isPgpKey());
      let pgpSignatureAttachment = this.email?.payload.attachments.find(a => a.isPgpSignature());
      let signedContent = this.email?.payload.signedContent();

      if(pgpKeyAttachment?.body !== undefined && pgpSignatureAttachment?.body !== undefined && signedContent?.raw !== undefined){
        this.publicKey = await this.pgpService.importPublicKey(pgpKeyAttachment.decodedText());
        let verificationResult = await this.pgpService.verify(pgpKeyAttachment.decodedText(), pgpSignatureAttachment.decodedText(), signedContent.raw);
        for(let result of verificationResult.signatures){
          try{
            let signature = await result.signature;
            this.signatureResults.push(new SignatureVerificationResult('0x' + result.keyID.toHex().toUpperCase(), await result.verified, signature.packets[0].created ?? undefined));          
          }
          catch(ex){
            this.signatureResults.push(new SignatureVerificationResult('0x' + result.keyID.toHex().toUpperCase(), false, undefined));   
          }
        }
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

  class SignatureVerificationResult{
    constructor(
      public readonly keyId: string,
      public readonly verified: boolean,
      public readonly signedAt: Date | undefined,
    ) {}
  }

