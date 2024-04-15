import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { AuthenticationModule } from '../authentication';
import { E2EEncComponent } from './pages/e2e-enc.component';
import { DataService } from './services/data/data.service';
import { PingService } from './services/ping/ping.service';
import { SidService } from './services/sid/sid.service';
import { BASE_PATH } from './types/variables';

@NgModule({
  imports: [
    AuthenticationModule,
    CommonModule,
    HttpClientModule,
    MatButtonModule,
  ],
  declarations: [
    E2EEncComponent,
  ],
  providers: [
    DataService,
    PingService,
    SidService,
    { provide: BASE_PATH, useValue: 'http://localhost:4040' },
  ],
  exports: [
    E2EEncComponent,
  ],
})
export class E2EEncModule { }
