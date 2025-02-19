import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { PgpService } from '../../services/pgp/pgp.service';
import { Identity, IdentityService } from 'src/app/modules/authentication';

import * as openpgp from 'openpgp';

@Component({
  selector: 'app-pgp-import',
  templateUrl: './pgp-import.component.html',
  styleUrls: ['./pgp-import.component.scss'],
})
export class PgpImportComponent {

  /**
   * Gets the available identities.
   */
  public get identities(): Identity[] {
    return this.identityService.identities;
  }

  /**
   * Form Group to import PGP Key File.
   */
  public readonly pgpForm = new FormGroup({
    identities: new FormControl<Identity[]>([]),
    passphrase: new FormControl<string>(''),
  });

  /**
   * Constructs a new PGP Import Component.
   * @param pgpService PGP Service instance.
   * @param identityService Identity Service instance.
   */
  constructor(
    private readonly pgpService: PgpService,
    private readonly identityService: IdentityService,
  ) { }

  private _selectedFile: File | undefined;

  /**
   * Gets the selected file.
   */
  public get selectedFile(): File | undefined {
    return this._selectedFile;
  }

  /**
   * Reads a file.
   * @param file File reference.
   * @returns Content of File as Array Buffer.
   */
  private async readFile(file: File): Promise<ArrayBuffer> {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      try {
        const fileReader = new FileReader();
        fileReader.addEventListener('loadend', (ev) => {
          const result = ev.target?.result as ArrayBuffer | undefined;
          if (result) {
            resolve(result);
          } else {
            reject('Result was empty!');
          }
        });
        fileReader.readAsArrayBuffer(file);
      } catch (e) {
        reject(e);
      }
    });
  }

  onFileSelected(event: Event) {

    let eventTarget = event.target as HTMLInputElement;

    if(eventTarget){
      this._selectedFile = eventTarget.files?.item(0) ?? undefined;
      console.log(this.selectedFile);
    }
  }

  /**
   * Imports the selected PGP Key.
   */
  public async import(): Promise<void> {
    // Get private key file.
    const file = this.selectedFile;
    if (!file) return;

    // Get passphrase.
    const passphrase = this.pgpForm.controls.passphrase.value;
    if (!passphrase) return;

    // Get Identities.
    const identities = this.pgpForm.controls.identities.value;
    if (!identities?.length) return;

    // Read the PGP private key file and import it.
    const pgpKeyFile = await this.readFile(file);
    let pgpPrivateKey: openpgp.PrivateKey | undefined;
    
    // try armored and binary version of the key
    try{
      const pgpKeyString = new TextDecoder('utf-8').decode(pgpKeyFile);
      pgpPrivateKey = await this.pgpService.importPrivateKey(pgpKeyString);
    }
    catch(err){
      try{
        pgpPrivateKey = await this.pgpService.importBinaryPrivateKey(new Uint8Array(pgpKeyFile));
      }
      catch(err){
        return;
      }
    }
    
    for(let identity of identities){
      // Register the imported private key for each identity.
      this.pgpService.addPrivateKey({
        key: pgpPrivateKey,
        identity,
        passphrase: passphrase,
      });
    }

    // Reset the PGP Form.
    this.pgpForm.reset();
    this._selectedFile = undefined;
  }
}
