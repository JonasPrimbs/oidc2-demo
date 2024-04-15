import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app/app.component';
import { AuthenticationModule, AuthenticationOptions, IdentityProvider } from './modules/authentication';
import { E2EEncModule } from './modules/e2e-enc';
import { EmailModule } from './modules/email';
import { InstantMessagingModule } from './modules/instant-messaging';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    AppRoutingModule,
    AuthenticationModule.forRoot(
      new AuthenticationOptions([
        new IdentityProvider(
          'Keycloak',
          'http://op.localhost/realms/ict',
          'oidc2-demo',
          undefined,
          'assets/keycloak_logo.png',
          [
            'openid',
            'profile',
            'email',
            'e2e_auth_email',
          ],
          true,
        ),
        new IdentityProvider(
          'Google',
          'https://accounts.google.com',
          '234907810572-qbo2aqu2l84de8kvm1o2l7j93pfcsh5u.apps.googleusercontent.com',
          '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',
          'assets/google_logo.svg',
          [
            'openid',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
          ],
        ),
      ]),
    ),
    BrowserModule,
    BrowserAnimationsModule,
    E2EEncModule,
    EmailModule,
    InstantMessagingModule,
    MatButtonModule,
    MatCardModule,
    MatGridListModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
