import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PgpImportOnlineComponent } from './pgp-import-online.component';

describe('PgpLoadComponent', () => {
  let component: PgpImportOnlineComponent;
  let fixture: ComponentFixture<PgpImportOnlineComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PgpImportOnlineComponent]
    });
    fixture = TestBed.createComponent(PgpImportOnlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
