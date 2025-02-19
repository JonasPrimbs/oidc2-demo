import { TestBed } from '@angular/core/testing';
import { SynchronizationService } from './synchronization.service';

describe('DataService', () => {
  let service: SynchronizationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SynchronizationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
