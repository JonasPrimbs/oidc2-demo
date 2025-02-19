import { TestBed } from '@angular/core/testing';
import { PgpKeyAuthenticationService } from './pgp-key-authentication.service';


describe('Oidc2VerificationService', () => {
  let service: PgpKeyAuthenticationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PgpKeyAuthenticationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
