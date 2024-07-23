import { Component } from '@angular/core';

import * as openpgp from 'openpgp';

import { PgpService } from '../../services/pgp/pgp.service';
import { Identity, IdentityService } from 'src/app/modules/authentication';
import { GmailApiService } from '../../services/gmail-api/gmail-api.service';
import { decodeAndParseMimeMessage } from '../../classes/mime-message/mime-message';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-pgp-load',
  templateUrl: './pgp-load.component.html',
  styleUrls: ['./pgp-load.component.scss'],
})
export class PgpLoadComponent {
  
  /**
   * Constructs a new PGP Load Component.
   * @param pgpService PGP Service instance.
   * @param identityService Identity Service instance.
   */
  constructor(
    private readonly pgpService: PgpService,
    private readonly identityService: IdentityService,
    private readonly gmailApiService: GmailApiService,
  ) 
  {
    this.pgpForm.controls.identity.valueChanges.subscribe(x => this.search());   
  }

  /**
   * Gets the available identities.
   */
   public get identities(): Identity[] {
    return this.identityService.identities;
  }

  public privateKeys : openpgp.PrivateKey[] = [];

  /**
     * Form Group to import PGP Key File.
     */
  public readonly pgpForm = new FormGroup({
    identity: new FormControl<Identity | undefined>(undefined),
  });

  public async search(){
    let identity = this.pgpForm.controls.identity.value;

    if(!identity){
      return
    }

    let mails = await this.gmailApiService.listMails(identity, `label:${this.gmailApiService.privateKeyLabelName}`);
    
    this.privateKeys = [];
    for(let mail of mails){
      try{
        let message = await this.gmailApiService.getMessage(identity, mail.id);
        if(!message?.raw){
          continue;
        }
        let mimeMessage = decodeAndParseMimeMessage(message.raw);
        let privateKeyAttachment = mimeMessage.payload.attachments.find(a => a.name === "private_key.asc");
        let armoredPrivateKey = privateKeyAttachment?.decodedText();
        if(!armoredPrivateKey){
          continue;
        }
        console.log({armoredPrivateKey});
        let privateKey = await this.pgpService.importPrivateKey(armoredPrivateKey);
        
        this.privateKeys.push(privateKey);
      }
      catch{ }      
    }
  }

  public async load(privateKey: openpgp.PrivateKey, passphrase: string){
    console.log(privateKey);
    console.log(passphrase);
  }

  
}
