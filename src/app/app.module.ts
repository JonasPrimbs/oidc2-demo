import { NgModule } from '@angular/core';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
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
            'https://www.googleapis.com/auth/gmail.labels',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://mail.google.com/',
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
export class AppModule { 
  constructor(
    private readonly matIconRegistry: MatIconRegistry,
    private readonly sanitizer: DomSanitizer,
    ){
      matIconRegistry.addSvgIcon('lock-check-outline', sanitizer.bypassSecurityTrustResourceUrl('assets/lock_check_outline.svg'));
      matIconRegistry.addSvgIcon('certificate', sanitizer.bypassSecurityTrustResourceUrl('assets/certificate.svg'));
      matIconRegistry.addSvgIcon('email-alert-outline', sanitizer.bypassSecurityTrustResourceUrl('assets/email_alert_outline.svg'));
  }
}
