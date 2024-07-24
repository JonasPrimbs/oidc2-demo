import { Component } from '@angular/core';

import * as openpgp from 'openpgp';

import { PgpService } from '../../services/pgp/pgp.service';
import { Identity, IdentityService } from 'src/app/modules/authentication';
import { GmailApiService } from '../../services/gmail-api/gmail-api.service';
import { decodeAndParseMimeMessage } from '../../classes/mime-message/mime-message';
import { FormArray, FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-pgp-manage',
  templateUrl: './pgp-manage.component.html',
  styleUrls: ['./pgp-manage.component.scss'],
})
export class PgpManageComponent {
  
  /**
   * Constructs a new PGP Load Component.
   * @param pgpService PGP Service instance.
   */
  constructor(
    private readonly pgpService: PgpService,
  ) 
  { 
    this.pgpService.privateKeysChange.subscribe(() => this.loadKeys());
  }

  public privateKeys: {keyId: string, privateKey: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }}[] = [];

  private loadKeys(){
    this.privateKeys = [];
    for(let privateKey of this.pgpService.privateKeys){
      let temp = { 
        keyId: this.pgpService.getPrettyKeyID(privateKey.key.getKeyID()),
        privateKey: privateKey,
      };
      this.privateKeys.push(temp);
    }
  }

  public async savePrivateKey(privateKey: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }){
    await this.pgpService.savePrivateKey(privateKey);
  }


}


