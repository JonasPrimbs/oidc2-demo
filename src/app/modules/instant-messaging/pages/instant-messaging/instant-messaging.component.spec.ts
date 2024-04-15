import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstantMessagingComponent } from './instant-messaging.component';

describe('InstantMessagingComponent', () => {
  let component: InstantMessagingComponent;
  let fixture: ComponentFixture<InstantMessagingComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [InstantMessagingComponent]
    });
    fixture = TestBed.createComponent(InstantMessagingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
