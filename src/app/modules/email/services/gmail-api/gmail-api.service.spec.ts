import { TestBed } from '@angular/core/testing';
import { GmailApiService } from './gmail-api.service';


describe('GmailApiService', () => {
  let service: GmailApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GmailApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
