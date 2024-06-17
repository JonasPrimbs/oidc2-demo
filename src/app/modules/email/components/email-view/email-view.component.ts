import { Component } from '@angular/core';
import { Identity, IdentityProvider } from 'src/app/modules/authentication';
import { EmailContent } from '../../classes/email-content/email-content';
import { Email } from '../../classes/email/email';
import { EmailMessage, EmailMessagePart } from '../../classes/email/message';
import { EmailService } from '../../services/email/email.service';
import { PgpService } from '../../services/pgp/pgp.service';

@Component({
  selector: 'app-email-view',
  templateUrl: './email-view.component.html',
  styleUrls: ['./email-view.component.scss']
})
export class EmailViewComponent {

  private mailIndex: number = 0;
  public email: EmailMessage | undefined;

  public get disabledNext (){
    return this.mailIndex <= 0;
  } 

  public comment: string | undefined;

  constructor(
    private readonly emailService: EmailService,
    private readonly pgpService: PgpService
  ){    
    } 

    public async loadMail() : Promise<void>{
      this.email = await this.emailService.readEmail(this.mailIndex);
      this.comment = this.email?.payload.displayText;
      console.log(this.comment);
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

