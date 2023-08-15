import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import * as openpgp from 'openpgp';

import { Identity } from '../../../authentication';
import { Email } from '../../classes/email/email';
import { EmailContent } from '../../classes/email-content/email-content';
import { EmailService } from '../../services/email/email.service';
import { PgpService } from '../../services/pgp/pgp.service';

@Component({
  selector: 'app-email-editor',
  templateUrl: './email-editor.component.html',
  styleUrls: ['./email-editor.component.scss'],
})
export class EmailEditorComponent implements OnInit {
  /**
   * Gets the available sender identities.
   */
  public get senders(): Identity[] {
    return this.emailService.senderIdentities;
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
      const firstIdentity = key.identities[0];
      return {
        key: key.key,
        passphrase: key.passphrase,
        name: `${firstIdentity?.claims.name} (${firstIdentity.identityProvider.name})`,
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
  });

  /**
   * Gets an email instance from the email form.
   */
  private get email(): Email | undefined {
    if (!this.emailForm.controls.from.value) {
      return undefined;
    } else {
      return new Email(
        this.emailForm.controls.from.value,
        this.emailForm.controls.to.value ?? '',
        this.emailForm.controls.subject.value ?? '',
        [
          new EmailContent(this.emailForm.controls.body.value ?? ''),
        ],
        this.emailForm.controls.key.value ?? undefined,
      );
    }
  }

  /**
   * Constructs a new Email Editor Component.
   * @param emailService Email Service instance.
   * @param pgpService PGP Service instance.
   */
  constructor(
    private readonly emailService: EmailService,
    private readonly pgpService: PgpService,
  ) { }

  /**
   * Initializes the component.
   */
  ngOnInit(): void {
    this.pgpService.privateKeysChange.subscribe(() => {
      this.updateAvailableKeys();
    });
    this.emailForm.controls.from.valueChanges.subscribe(() => {
      this.updateAvailableKeys();
    });
  }

  /**
   * Sends the email.
   */
  public async sendEmail(): Promise<void> {
    // Get the email instance to send.
    const email = this.email;
    if (!email) return;

    // Send the email instance.
    await this.emailService.sendEmail(email);
  }
}
