import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EmailComponent } from './modules/email';
import { InstantMessagingComponent } from './modules/instant-messaging';

const routes: Routes = [
  // Redirect root to emails
  { path: '', redirectTo: '/emails', pathMatch: 'full' },
  // /emails -> Emails
  { path: 'emails', component: EmailComponent },
  // /messages -> Instant Messages
  { path: 'messages', component: InstantMessagingComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
