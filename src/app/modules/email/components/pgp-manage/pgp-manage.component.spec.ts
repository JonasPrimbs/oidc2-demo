import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PgpManageComponent } from './pgp-manage.component';

describe('PgpManageComponent', () => {
  let component: PgpManageComponent;
  let fixture: ComponentFixture<PgpManageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PgpManageComponent]
    });
    fixture = TestBed.createComponent(PgpManageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
