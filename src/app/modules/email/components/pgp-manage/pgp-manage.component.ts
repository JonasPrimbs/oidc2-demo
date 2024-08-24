import { Component } from '@angular/core';

import * as openpgp from 'openpgp';

import { PgpService } from '../../services/pgp/pgp.service';
import { Identity, IdentityService } from 'src/app/modules/authentication';
import { GmailApiService } from '../../services/gmail-api/gmail-api.service';
import { decodeAndParseMimeMessage } from '../../classes/mime-message/mime-message';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { AttachmentFile } from '../../classes/attachment-file/attachment-file';
import { PublicKeyOwnership } from '../../types/public-key-ownership.interface';
import { PrivateKeyRepresentation } from '../../types/private-key-representation.interface';

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
  { }

  public get publicKeyOwnerships() {
    return this.pgpService.publicKeyOwnerships;
  }

  public get privateKeys(){
    return this.pgpService.privateKeys;
  }

  public async savePrivateKey(privateKey: PrivateKeyRepresentation){
    await this.pgpService.savePrivateKey(privateKey);
  }

  public async deletePrivateKey(privateKey: PrivateKeyRepresentation){
    await this.pgpService.deletePrivateKey(privateKey);
  }

  public async removePublicKeyOwnership(publicKeyOwnership: PublicKeyOwnership){
    this.pgpService.removePublicKeyOwnership(publicKeyOwnership);
  }

  public getKeyId(key: openpgp.PublicKey | openpgp.PrivateKey): string{
    return this.pgpService.getPrettyKeyID(key.getKeyID());
  }
}


