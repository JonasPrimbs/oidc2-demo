import { Component } from '@angular/core';

import { PgpService } from '../../services/pgp/pgp.service';
import { Identity, IdentityService } from 'src/app/modules/authentication';
import { GmailApiService } from '../../services/gmail-api/gmail-api.service';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { PrivateKeyOwnership } from '../../types/private-key-ownership.interface';

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
    this.identityService.identitiesChanged.subscribe(() => this.relaodPrivateKeys()); 
  }

  /**
   * Gets the available gmail identities.
   */
   public get identities(): Identity[] {
    return this.identityService.identities.filter(i => i.hasGoogleIdentityProvider);
  }

  // public privateKeys : openpgp.PrivateKey[] = [];

  /**
     * Form Group to import PGP Key File.
     */
  public readonly pgpForm = new FormGroup({
    identity: new FormControl<Identity | undefined>(undefined),
    privateKeys: new FormArray<FormGroup<PrivateKeyForm>>([]),
  });

  public async relaodPrivateKeys(){
    for(let identity of this.identities){
      let privateKeyOwnerships = await this.gmailApiService.loadPrivateKeyOwnerships(identity);
      
      for(let privateKeyOwnership of privateKeyOwnerships){
        let keyId = this.pgpService.getPrettyKeyID(privateKeyOwnership.privateKey.getKeyID());
        
        let privateKeyControl = new FormGroup<PrivateKeyForm>({
          privateKeyOwnership: new FormControl<PrivateKeyOwnership>(privateKeyOwnership),
          keyId: new FormControl<string>(keyId),
          passphrase: new FormControl<string>(''),
        });
        
        this.pgpForm.controls.privateKeys.push(privateKeyControl);  
      }
    }
  }

  public async load(i: number){
    let privateKeyForm = this.pgpForm.controls.privateKeys.at(i);
    let passphrase = privateKeyForm.controls.passphrase.value;
    let privateKeyOwnership = privateKeyForm.controls.privateKeyOwnership.value;

    if(passphrase && privateKeyOwnership){
      this.pgpService.addPrivateKey({key: privateKeyOwnership.privateKey, identities: [privateKeyOwnership.identity], passphrase, messageId: privateKeyOwnership.messageId});
      this.pgpForm.controls.privateKeys.removeAt(i);
    }
  }
}

type PrivateKeyForm = { 
  privateKeyOwnership: FormControl<PrivateKeyOwnership | null>,
  keyId: FormControl<string | null>,
  passphrase: FormControl<string | null>,
};

