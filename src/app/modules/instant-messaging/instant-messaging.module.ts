import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthenticationModule } from '../authentication';
import { InstantMessagingComponent } from './pages/instant-messaging/instant-messaging.component';
import { InstantMessagingService } from './services/instant-messaging/instant-messaging.service';

@NgModule({
  imports: [
    AuthenticationModule,
    CommonModule,
  ],
  declarations: [
    InstantMessagingComponent,
  ],
  providers: [
    InstantMessagingService,
  ],
  exports: [
    InstantMessagingComponent,
  ],
})
export class InstantMessagingModule { }
