import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { Identity } from '../../../authentication';
import { Email } from '../../classes/email/email';
import { EmailService } from '../../services/email/email.service';
import { EmailContent } from '../../classes/email-content/email-content';
import { AttachmentFile } from '../../classes/attachment-file/attachment-file';

@Component({
  selector: 'app-email-editor',
  templateUrl: './email-editor.component.html',
  styleUrls: ['./email-editor.component.scss'],
})
export class EmailEditorComponent {
  /**
   * Gets the available sender identities.
   */
  public get senders(): Identity[] {
    return this.emailService.senderIdentities;
  }

  /**
   * The email form.
   */
  public readonly emailForm = new FormGroup({
    from: new FormControl<Identity | null>(null),
    to: new FormControl<string>(''),
    subject: new FormControl<string>(''),
    body: new FormControl<string>(''),
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
          new AttachmentFile('test.txt', '', 'text/txt'),
        ],
      );
    }
  }

  /**
   * Constructs a new Email Editor Component.
   * @param emailService Email Service instance.
   */
  constructor(
    private readonly emailService: EmailService,
  ) { }

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
