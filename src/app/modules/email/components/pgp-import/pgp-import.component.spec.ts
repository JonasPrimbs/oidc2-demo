import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PgpImportComponent } from './pgp-import.component';

describe('PgpImportComponent', () => {
  let component: PgpImportComponent;
  let fixture: ComponentFixture<PgpImportComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PgpImportComponent]
    });
    fixture = TestBed.createComponent(PgpImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
