import { Component } from '@angular/core';
import { Identity, IdentityProvider } from 'src/app/modules/authentication';
import { EmailContent } from '../../classes/email-content/email-content';
import { Email } from '../../classes/email/email';
import { EmailService } from '../../services/email/email.service';
import { PgpService } from '../../services/pgp/pgp.service';

@Component({
  selector: 'app-email-view',
  templateUrl: './email-view.component.html',
  styleUrls: ['./email-view.component.scss']
})
export class EmailViewComponent {

  public email: Email | undefined;

  public mailBody: string | undefined;

  constructor(
    private readonly emailService: EmailService,
    private readonly pgpService: PgpService
  ){

    var userId = { 
      name: "user", 
      email: "user@mail.com" 
    };
    var passphrase = "secure";

    var keyPair = pgpService.generateKeyPair(userId, passphrase);

    var idProvider = new IdentityProvider (
       "keycloak",
       "op.localhost",
       "client_id",
       undefined,
       undefined,
       undefined,
       false,
    );

    var sender = new Identity(userId, idProvider, undefined, undefined, undefined, undefined);

    var body = new EmailContent("Das hier ist eine lange Mail:\n es geht um meine Masterarbeit und vieles anderes\nsojasfhoj aosdhfklöjasfd öajosldhfölkjn öasoldfhöljaksfdh öalsdfhölkj aäslködfh öalsdhfölasfd öalskdh asöldfnas asödljnfasdf aasdf asdf asdfjlkshf alsjdfa sdfkasjf asdkjfbasjkfhasd faskljdfhaskm askfjhsfjask ksajfhdaskd fksajfhaskdjfjalskfhbsakdbksadf ksjfhsa fkjasdfhkj oljhas asdf kajsdf asdfa sdfasdfasdf asdfasf asdfsa dfasfdasdf asdf asdfasdfas df asfdasf asdf asd fas fasfd asdf asd fasdfasdf sad f asdf, jetzt reicht es auch");

    keyPair.then(key => {
      this.email = new Email(sender, 
        "test@mail.com",
        "Mail-example", 
        [ body ],
        {
          key: key.privateKey,
          passphrase,
        });
        this.mailBody = (this.email?.parts.find(p => p instanceof EmailContent) as EmailContent)?.body;
      });     
    } 
    
    public loadMails(): void{
      this.emailService.readEmail();
    }
    
    
  }

