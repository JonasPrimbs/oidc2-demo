import { Component } from '@angular/core';

import { Identity, IdentityService } from '../../../authentication';
import { EmailService } from '../../services/email/email.service';
import { Email } from '../../classes/email/email';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-email-editor',
  templateUrl: './email-editor.component.html',
  styleUrls: ['./email-editor.component.scss'],
})
export class EmailEditorComponent {
  public get senders(): Identity[] {
    return this.emailService.senderIdentities;
  }

  public emailForm = new FormGroup({
    from: new FormControl<Identity | null>(null),
    to: new FormControl<string>(''),
    subject: new FormControl<string>(''),
    body: new FormControl<string>(''),
  });

  private get email(): Email | undefined {
    if (!this.emailForm.controls.from.value) {
      return undefined;
    } else {
      return new Email(
        this.emailForm.controls.from.value,
        this.emailForm.controls.to.value ?? '',
        this.emailForm.controls.subject.value ?? '',
        this.emailForm.controls.body.value ?? '',
      );
    }
  }

  constructor(
    private readonly emailService: EmailService,
  ) { }
}
