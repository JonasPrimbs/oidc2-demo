import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { OidcRedirectComponent } from './modules/authentication';
import { EmailComponent } from './modules/email';
import { InstantMessagingComponent } from './modules/instant-messaging';
import { E2EEncComponent } from './modules/e2e-enc/pages/e2e-enc.component';

const routes: Routes = [
  // Redirect root to e2e-encryption application
  { path: '', redirectTo: '/e2e-enc', pathMatch: 'full' },
  // OAuth 2 redirect URI
  { path: 'oidc-redirect', component: OidcRedirectComponent, title: 'OIDC² Demo' },
  // /e2e-enc -> End-to-end encrypted communication with server
  {path: 'e2e-enc', component: E2EEncComponent, title: 'E2E encryption - OIDC² Demo'},
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
