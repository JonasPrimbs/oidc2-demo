import { Component, inject } from '@angular/core';

import * as openpgp from 'openpgp';

import { PgpService } from '../../services/pgp/pgp.service';
import { PublicKeyOwnership } from '../../types/public-key-ownership.interface';
import { PrivateKeyOwnership } from '../../types/private-key-ownership.interface';
import { DataService } from '../../services/data/data.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-pgp-manage',
  templateUrl: './pgp-manage.component.html',
  styleUrls: ['./pgp-manage.component.scss'],
})
export class PgpManageComponent {
  
  /**
   * The MatSnackBar Object
   */
   private snackBar = inject(MatSnackBar);
   
  /**
   * Constructs a new PGP Load Component.
   * @param pgpService PGP Service instance.
   */
  constructor(
    private readonly pgpService: PgpService,
    private readonly dataService: DataService,
  ) 
  { }

  /**
   * displayed columns of the private key table
   */
  public displayedPrivateKeyColumns: string[] = ['privIdentity', 'privKey', 'privAction'];
  
  /**
   * private keys
   */
  public get privateKeys(){
    return this.pgpService.privateKeys;
  }

  /**
   * save private key to google
   * @param privateKey 
   */
  public async savePrivateKey(privateKey: PrivateKeyOwnership){
    let canStoreDataResult = this.dataService.canStoreData(privateKey.identity);
    if(canStoreDataResult.canStoreData){
      let res = await this.dataService.savePrivateKey(privateKey);
      if(res){
        this.openSnackBar("private key stored!");
        return;
      }
    }
    this.openSnackBar(canStoreDataResult.errorMessage ?? "something went wrong");
  }

  /**
   * delete private key from google
   * @param privateKey 
   */
  public async deletePrivateKey(privateKey: PrivateKeyOwnership){
    await this.dataService.deletePrivateKey(privateKey);
  }
   
  /**
   * displayed columns of the public key table
   */
  public displayedPublicKeyColumns: string[] = ['pubIdentity', 'pubKey', 'pubOwner', 'pubDelete'];

  /**
   * public keys
   */
   public get publicKeys() {
    return this.pgpService.publicKeys;
  }

  /**
   * delete public key from google
   * @param publicKey 
   */
  public async deletePublicKey(publicKey: PublicKeyOwnership){
    this.dataService.deletePublicKey(publicKey);
  }

  /**
   * get the pretty key ID of a key
   * @param key 
   * @returns 
   */
  public getKeyId(key: openpgp.PublicKey | openpgp.PrivateKey): string{
    return this.pgpService.getPrettyKeyID(key.getKeyID());
  }

  /**
   * Shows a small message
   * @param message 
   */
   private openSnackBar(message: string) {
    this.snackBar.open(message);
  }
}


