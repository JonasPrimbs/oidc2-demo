import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrustworthyIctIssueManageComponent } from './trustworthy-ict-issue-manage.component';

describe('TrustworthyIctIssueManageComponent', () => {
  let component: TrustworthyIctIssueManageComponent;
  let fixture: ComponentFixture<TrustworthyIctIssueManageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TrustworthyIctIssueManageComponent]
    });
    fixture = TestBed.createComponent(TrustworthyIctIssueManageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
