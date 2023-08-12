import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { IdentityMenuComponent } from './components/identity-menu/identity-menu.component';
import { ProfileImageComponent } from './components/profile-image/profile-image.component';
import { IdentityService } from './services/identity/identity.service';

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  declarations: [
    IdentityMenuComponent,
    ProfileImageComponent,
  ],
  providers: [
    IdentityService,
  ],
  exports: [
    IdentityMenuComponent,
    ProfileImageComponent,
  ],
})
export class AuthenticationModule { }
