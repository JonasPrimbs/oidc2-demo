import { Component, ViewChild } from '@angular/core';

import { PgpService } from '../../services/pgp/pgp.service';
import { Identity, IdentityService } from 'src/app/modules/authentication';
import { GmailApiService } from '../../services/gmail-api/gmail-api.service';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { OnlinePrivateKey } from '../../types/online-private-key.interface';
import { MatTable } from '@angular/material/table';
import { SynchronizationService } from '../../services/synchronization/synchronization.service';

@Component({
  selector: 'app-pgp-import-online',
  templateUrl: './pgp-import-online.component.html',
  styleUrls: ['./pgp-import-online.component.scss'],
})
export class PgpImportOnlineComponent {
  
  /**
   * Constructs a new PGP Load Component.
   * @param pgpService PGP Service instance.
   * @param identityService Identity Service instance.
   */
  constructor(
    private readonly pgpService: PgpService,
    private readonly identityService: IdentityService,
    private readonly gmailApiService: GmailApiService,
    private readonly dataService: SynchronizationService,
  ) 
  {
    this.dataService.onlinePrivateKeysChanged.subscribe(() => this.relaodOnlinePrivateKeys()); 
  }

  /**
   * the table of the private keys stored in gmail (for updating rows)
   */
  @ViewChild(MatTable) 
  public table?: MatTable<any>;

  /**
   * Gets the available gmail identities.
   */
   public get identities(): Identity[] {
    return this.identityService.identities.filter(i => i.hasGoogleIdentityProvider);
  }

  /**
   * Form Group to import PGP Key File.
   */
  public readonly pgpForm = new FormGroup({
    privateKeys: new FormArray<FormGroup<PrivateKeyForm>>([]),
  });

  /**
   * private keys stored in gmail
   */
  public get privateKeys(): FormArray<FormGroup<PrivateKeyForm>>{
    return this.pgpForm.controls.privateKeys;
  } 

  /**
   * reload the online (gmail) private keys
   */
  public async relaodOnlinePrivateKeys(){
    this.pgpForm.controls.privateKeys.clear();
    for(let onlinePrivateKey of this.dataService.onlinePrivateKeys){      
      let keyId = this.pgpService.getPrettyKeyID(onlinePrivateKey.privateKey.getKeyID());      
      let privateKeyControl = new FormGroup<PrivateKeyForm>({
        key: new FormControl<OnlinePrivateKey>(onlinePrivateKey),
        keyId: new FormControl<string>(keyId),
        passphrase: new FormControl<string>(''),
      });
      
      this.pgpForm.controls.privateKeys.push(privateKeyControl);        
    }

    if(this.table){
      this.table.renderRows();
    }
  } 

  /**
   * import an online private key for use
   * @param i 
   */
  public async import(i: number){
    let privateKeyForm = this.pgpForm.controls.privateKeys.at(i);
    let passphrase = privateKeyForm.controls.passphrase.value;
    let privateKey = privateKeyForm.controls.key.value;

    if(passphrase && privateKey){
      this.pgpService.addPrivateKey({key: privateKey.privateKey, identity: privateKey.identity, passphrase, messageId: privateKey.messageId});
      this.pgpForm.controls.privateKeys.removeAt(i);
      if(this.table){
        this.table.renderRows();
      }
    }
  }

  /**
   * delete an online private key in gmail
   * @param i 
   */
  public async delete(i: number){
    let privateKeyForm = this.pgpForm.controls.privateKeys.at(i);
    let privateKey = privateKeyForm.controls.key.value;

    if(privateKey){
      this.gmailApiService.deleteMesage(privateKey.identity, privateKey.messageId);
      this.pgpForm.controls.privateKeys.removeAt(i);
      if(this.table){
        this.table.renderRows();
      }
    }
  }

  /**
   * the displayed columns
   */
  public displayedColumns = ['identity', 'key', 'passphrase', 'import', 'delete'];
}

type PrivateKeyForm = { 
  key: FormControl<OnlinePrivateKey | null>,
  keyId: FormControl<string | null>,
  passphrase: FormControl<string | null>,
};

