import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PgpLoadComponent } from './pgp-load.component';

describe('PgpLoadComponent', () => {
  let component: PgpLoadComponent;
  let fixture: ComponentFixture<PgpLoadComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PgpLoadComponent]
    });
    fixture = TestBed.createComponent(PgpLoadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
