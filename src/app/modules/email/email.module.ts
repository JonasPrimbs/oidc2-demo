import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthenticationModule } from '../authentication';
import { EmailComponent } from './pages/email/email.component';
import { EmailService } from './services/email/email.service';

@NgModule({
  imports: [
    AuthenticationModule,
    CommonModule,
  ],
  declarations: [
    EmailComponent,
  ],
  providers: [
    EmailService,
  ],
  exports: [
    EmailComponent,
  ],
})
export class EmailModule { }
