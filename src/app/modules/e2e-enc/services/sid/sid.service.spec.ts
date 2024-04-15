import { TestBed } from '@angular/core/testing';

import { SidService } from './sid.service';

describe('SidService', () => {
  let service: SidService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
