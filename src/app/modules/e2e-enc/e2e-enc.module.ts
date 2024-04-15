import { TextFieldModule } from '@angular/cdk/text-field';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AuthenticationModule } from '../authentication';
import { E2EEncComponent } from './pages/e2e-enc.component';
import { DataService } from './services/data/data.service';
import { PingService } from './services/ping/ping.service';
import { SidService } from './services/sid/sid.service';

@NgModule({
  imports: [
    AuthenticationModule,
    CommonModule,
    HttpClientModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TextFieldModule,
  ],
  declarations: [
    E2EEncComponent,
  ],
  providers: [
    DataService,
    SidService,
    PingService
  ],
  exports: [
    E2EEncComponent,
  ],
})
export class E2EEncModule { }
