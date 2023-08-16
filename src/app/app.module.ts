import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app/app.component';
import { AuthenticationModule, AuthenticationOptions, IdentityProvider } from './modules/authentication';
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
          'https://upload.wikimedia.org/wikipedia/commons/2/29/Keycloak_Logo.png',
          [
            'openid',
            'profile',
            'email',
          ],
          true,
        ),
        new IdentityProvider(
          'Google',
          'https://accounts.google.com',
          '234907810572-qbo2aqu2l84de8kvm1o2l7j93pfcsh5u.apps.googleusercontent.com',
          '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',
          'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg',
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
