import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OidcRedirectComponent } from './oidc-redirect.component';

describe('OidcRedirectComponent', () => {
  let component: OidcRedirectComponent;
  let fixture: ComponentFixture<OidcRedirectComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [OidcRedirectComponent]
    });
    fixture = TestBed.createComponent(OidcRedirectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
