export * from './services/data/data.service';
import { DataService } from './services/data/data.service';
export * from './services/ping/ping.service';
import { PingService } from './services/ping/ping.service';
export * from './services/sid/sid.service';
import { SidService } from './services/sid/sid.service';
export const APIS = [DataService, PingService, SidService];
