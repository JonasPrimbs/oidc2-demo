import { TestBed } from '@angular/core/testing';
import { PgpKeyCertificationService } from './pgp-key-certification.service';


describe('Oidc2AttachmentService', () => {
  let service: PgpKeyCertificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PgpKeyCertificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
