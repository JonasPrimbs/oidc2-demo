import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EmailComponent } from './modules/email';
import { InstantMessagingComponent } from './modules/instant-messaging';

const routes: Routes = [
  // Redirect root to emails
  { path: '', redirectTo: '/emails', pathMatch: 'full' },
  // /emails -> Emails
  { path: 'emails', component: EmailComponent, title: 'Email - OIDC² Demo' },
  // /messages -> Instant Messages
  { path: 'messages', component: InstantMessagingComponent, title: 'Messages - OIDC² Demo' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
