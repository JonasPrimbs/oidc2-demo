import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-profile-image',
  templateUrl: './profile-image.component.html',
  styleUrls: ['./profile-image.component.scss'],
})
export class ProfileImageComponent {
  /**
   * URL to profile image.
   */
  @Input()
  public picture?: string;

  /**
   * Fallback icon if no picture provided.
   */
  @Input()
  public icon: string = 'account_circle';
}
