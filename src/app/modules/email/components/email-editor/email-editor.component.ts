import { Component, inject, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl, FormGroup } from '@angular/forms';

import * as openpgp from 'openpgp';

import { Identity, IdentityService } from '../../../authentication';
import { Email } from '../../classes/email/email';
import { EmailContent } from '../../classes/email-content/email-content';
import { EmailService } from '../../services/email/email.service';
import { PgpService } from '../../services/pgp/pgp.service';
import { PgpKeyCertificationService } from '../../services/pgp-key-certification/pgp-key-certification.service';

@Component({
  selector: 'app-email-editor',
  templateUrl: './email-editor.component.html',
  styleUrls: ['./email-editor.component.scss'],
  // imports: [MatBottomSheetModule],
})
export class EmailEditorComponent implements OnInit {

  /**
   * The MatSnackBar Object
   */
  private snackBar = inject(MatSnackBar);

  /**
   * Constructs a new Email Editor Component.
   * @param emailService Email Service instance.
   * @param pgpService PGP Service instance.
   * @param identityService Identity Service instance.
   */
   constructor(
    private readonly emailService: EmailService,
    private readonly pgpService: PgpService,
    private readonly identityService: IdentityService,
    private readonly oidc2AttachmentService: PgpKeyCertificationService,
  ) { 
    this.emailForm.controls.from.valueChanges.subscribe(() => this.updateEncryptionDisabledState());
    this.emailForm.controls.to.valueChanges.subscribe(() => this.updateEncryptionDisabledState());
    this.pgpService.publicKeyOwnershipsChange.subscribe(() => this.updateEncryptionDisabledState());
  }

  /**
   * Initializes the component.
   */
  ngOnInit(): void {
    this.pgpService.privateKeysChanged.subscribe(() => {
      this.updateAvailableKeys();
    });
    this.emailForm.controls.from.valueChanges.subscribe(() => {
      this.updateAvailableKeys();
    });
  }

  /**
   * Gets the available sender identities.
   */
  public get senders(): Identity[] {
    return this.emailService.senderIdentities;
  }

  /**
   * Gets all identities whose Identity Provider supports issuing ICTs.
   */
  public get availableIdentities(): Identity[] {
    return this.identityService.identities.filter(
      id => id.identityProvider.supportsIcts,
    );
  }

  /**
   * The available signing keys.
   */
  public availableKeys: { key: openpgp.PrivateKey, passphrase: string, name: string }[] = [];

  /**
   * Gets the available PGP Keys.
   */
  public updateAvailableKeys(): void {
    const identity = this.emailForm.controls.from.value;
    const keys = identity ? this.pgpService.getKeysFor(identity) : [];
    this.availableKeys = keys.map(key => {
      return {
        key: key.key,
        passphrase: key.passphrase,
        name: `${key.identity.claims.name} (${key.identity.identityProvider.name}) - ${this.pgpService.getPrettyKeyID(key.key.getKeyID())}`,
      };
    });
  }

  /**
   * The email form.
   */
  public readonly emailForm = new FormGroup({
    from: new FormControl<Identity | null>(null),
    to: new FormControl<string>(''),
    subject: new FormControl<string>(''),
    body: new FormControl<string>(''),
    key: new FormControl<{ key: openpgp.PrivateKey, passphrase: string } | undefined>(undefined),
    identities: new FormControl<Identity[]>([]),
    encryption: new FormControl<boolean>({value: false, disabled: true}),
  });

  /**
   * Gets an email instance from the email form.
   */
  private getEmail(): Email | undefined {
    if (!this.emailForm.controls.from.value) {
      return undefined;
    } else {
      return new Email(
        this.emailForm.controls.from.value,
        this.emailForm.controls.to.value ?? '',
        this.emailForm.controls.subject.value ?? '',
        [
          new EmailContent(this.emailForm.controls.body.value ?? ''),
        ]
      );
    }
  }

  /**
   * Gets the selected private key or a random key if no key is selected
   * @returns 
   */
  private async getPrivateKey(): Promise<{key: openpgp.PrivateKey, passphrase: string}>{    
    let privateKey = this.emailForm.controls.key.value ?? await (async () => {
      const passphrase = this.identityService.generateRandomString(20);
      const keyPair = await this.pgpService.generateKeyPair({
        email: this.emailForm.controls.from.value?.claims.email!,
        name: this.emailForm.controls.from.value?.claims.name!,
      }, passphrase);
      return { key: keyPair.privateKey, passphrase };
    })();
    return privateKey;
  }

  /**
   * Sends the email.
   */
  public async sendEmail(): Promise<void> {
    const privateKey = await this.getPrivateKey();
    if(!privateKey) {
      this.openSnackBar('you need a private key');
      return;
    }

    // Get the email instance to send.
    const email = this.getEmail();
    if (!email) {
      this.openSnackBar('email could not be assembled');
      return;
    }

    // Get identities.
    const identities = this.emailForm.controls.identities.value;
    if (identities) {
      // generate and append ict/pop attachments
      let attachments = await this.oidc2AttachmentService.generateIctPopAttachments(identities, email.receiver, privateKey.key);
      attachments.forEach(a => email.parts.push(a));
    }
    
    // Send the email instance.
    let successfulSend = await this.emailService.sendEmail(email, privateKey.key, privateKey.passphrase, this.emailForm.controls.encryption.value ?? false);
    this.openSnackBar(successfulSend ? 'successfully sent' : 'send failed');
  }

  /**
   * Shows a small message
   * @param message 
   */
  private openSnackBar(message: string) {
    this.snackBar.open(message);
  }

  /**
   * update the disabled state of the encryption-checkbox
   */
  public updateEncryptionDisabledState(){
    if(this.emailForm.controls.to.value && this.emailForm.controls.from.value && this.pgpService.canBeEncrypted(this.emailForm.controls.from.value, this.emailForm.controls.to.value)){
      this.emailForm.controls.encryption.enable();
    }
    else{
      this.emailForm.controls.encryption.disable();
      this.emailForm.controls.encryption.setValue(false);
    }
  }
}
