import { TestBed } from '@angular/core/testing';

import { PgpService } from './pgp.service';

describe('PgpService', () => {
  let service: PgpService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PgpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
