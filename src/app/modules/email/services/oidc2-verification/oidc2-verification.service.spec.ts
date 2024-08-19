import { TestBed } from '@angular/core/testing';
import { Oidc2VerificationService } from './oidc2-verification.service';


describe('Oidc2VerificationService', () => {
  let service: Oidc2VerificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Oidc2VerificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
