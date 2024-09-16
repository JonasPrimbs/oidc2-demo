import { TestBed } from '@angular/core/testing';
import { Oidc2AttachmentService } from './oidc2-attachment.service';


describe('Oidc2AttachmentService', () => {
  let service: Oidc2AttachmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Oidc2AttachmentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
