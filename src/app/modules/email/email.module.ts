import { TextFieldModule } from '@angular/cdk/text-field';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs'; 
import { MatTableModule } from '@angular/material/table';

import { AuthenticationModule } from '../authentication';
import { EmailEditorComponent } from './components/email-editor/email-editor.component';
import { EmailViewComponent } from './components/email-view/email-view.component';
import { PgpImportComponent } from './components/pgp-import/pgp-import.component';
import { PgpImportOnlineComponent } from './components/pgp-import-online/pgp-import-online.component';
import { PgpManageComponent } from './components/pgp-manage/pgp-manage.component';
import { TrustworthyIctIssueManageComponent } from './components/trustworthy-ict-issuer-manage/trustworthy-ict-issuer-manage.component';
import { EmailComponent } from './pages/email/email.component';
import { EmailService } from './services/email/email.service';
import { GmailApiService } from './services/gmail-api/gmail-api.service';
import { Oidc2VerificationService } from './services/pgp-key-authentication/pgp-key-authentication.service';
import { PgpService } from './services/pgp/pgp.service';
import { MatSnackBarModule, MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';

@NgModule({
  imports: [
    AuthenticationModule,
    CommonModule,
    HttpClientModule,
    MatSnackBarModule,
    MatButtonModule,
    MatCheckboxModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatTableModule,
    MatListModule,
    ReactiveFormsModule,
    TextFieldModule,
  ],
  declarations: [
    EmailComponent,
    EmailEditorComponent,
    EmailViewComponent,
    PgpImportComponent,
    PgpImportOnlineComponent,
    PgpManageComponent,
    TrustworthyIctIssueManageComponent,
  ],
  providers: [
    GmailApiService,
    EmailService,
    PgpService,
    Oidc2VerificationService,
    {provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: {duration: 2500}}
  ],
  exports: [
    EmailComponent,
  ],
})
export class EmailModule { }
