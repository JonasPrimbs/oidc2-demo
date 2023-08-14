import { TextFieldModule } from '@angular/cdk/text-field';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule } from '@angular/forms';

import { AuthenticationModule } from '../authentication';
import { EmailEditorComponent } from './components/email-editor/email-editor.component';
import { EmailComponent } from './pages/email/email.component';
import { EmailService } from './services/email/email.service';

@NgModule({
  imports: [
    AuthenticationModule,
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TextFieldModule,
  ],
  declarations: [
    EmailComponent,
    EmailEditorComponent,
  ],
  providers: [
    EmailService,
  ],
  exports: [
    EmailComponent,
  ],
})
export class EmailModule { }
