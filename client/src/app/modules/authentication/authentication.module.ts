import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthenticationOptions } from './classes/authentication-options/authentication-options.class';
import { IdentityMenuComponent } from './components/identity-menu/identity-menu.component';
import { ProfileImageComponent } from './components/profile-image/profile-image.component';
import { OidcRedirectComponent } from './pages/oidc-redirect/oidc-redirect.component';
import { IdentityService } from './services/identity/identity.service';

@NgModule({
  declarations: [
    IdentityMenuComponent,
    OidcRedirectComponent,
    ProfileImageComponent,
  ],
  exports: [
    IdentityMenuComponent,
    OidcRedirectComponent,
    ProfileImageComponent,
  ],
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
],
  providers: [
    IdentityService,
    provideHttpClient(withInterceptorsFromDi()),
  ],
})
export class AuthenticationModule {
  static forRoot(options: AuthenticationOptions): ModuleWithProviders<AuthenticationModule> {
    return {
      ngModule: AuthenticationModule,
      providers: [
        { provide: AuthenticationOptions, useValue: options },
      ],
    };
  }
}
