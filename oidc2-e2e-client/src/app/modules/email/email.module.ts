import { TextFieldModule } from '@angular/cdk/text-field';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AuthenticationModule } from '../authentication';
import { EmailEditorComponent } from './components/email-editor/email-editor.component';
import { PgpImportComponent } from './components/pgp-import/pgp-import.component';
import { EmailComponent } from './pages/email/email.component';
import { EmailService } from './services/email/email.service';
import { PgpService } from './services/pgp/pgp.service';

@NgModule({
  imports: [
    AuthenticationModule,
    CommonModule,
    HttpClientModule,
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
    PgpImportComponent,
  ],
  providers: [
    EmailService,
    PgpService,
  ],
  exports: [
    EmailComponent,
  ],
})
export class EmailModule { }
