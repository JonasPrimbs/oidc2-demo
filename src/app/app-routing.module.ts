import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { OidcRedirectComponent } from './modules/authentication';
import { E2EEncComponent } from './modules/e2e-enc';
import { EmailComponent } from './modules/email';
import { InstantMessagingComponent } from './modules/instant-messaging';

const routes: Routes = [
  // Redirect root to e2e-encryption application
  { path: '', redirectTo: '/files', pathMatch: 'full' },
  // OAuth 2 redirect URI
  { path: 'oidc-redirect', component: OidcRedirectComponent, title: 'OIDC² Demo' },
  // /e2e-enc -> End-to-end encrypted communication with server
  { path: 'files', component: E2EEncComponent, title: 'Files - OIDC² Demo' },
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
