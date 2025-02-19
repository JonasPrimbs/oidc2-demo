import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

/**
 * The Prefix of the Local Storage key which stores the authorization code.
 */
export const OAUTH_AUTH_CODE_KEY_PREFIX = 'oauth_auth_code_';

@Component({
  selector: 'app-oidc-redirect',
  templateUrl: './oidc-redirect.component.html',
  styleUrls: ['./oidc-redirect.component.scss'],
})
export class OidcRedirectComponent {
  /**
   * Constructs a new OIDC Redirect Component.
   * @param activatedRoute Current Route.
   */
  constructor(
    private readonly activatedRoute: ActivatedRoute,
  ) {}

  /**
   * Error message returned from Authroization Server.
   */
  error?: string;

  /**
   * Whether the authorization code was already processed.
   */
  processed: boolean = false;

  /**
   * Initializes the component.
   */
  ngOnInit(): void {
    this.handleQueryParameters();
  }

  /**
   * Extracts the received authorization code from HTTP query parameter and stores it to the local storage.
   */
  private async handleQueryParameters(): Promise<void> {
    // Get HTTP Query parameters.
    const parameters = await firstValueFrom(this.activatedRoute.queryParams);

    // Write the error state.
    this.error = parameters['error'];
    if (this.error) {
      this.processed = true;
      return;
    }

    // Get the state parameter.
    const stateId = parameters['state'];

    // Generate the ID of the authorization code key in the local storage.
    const stateKey = OAUTH_AUTH_CODE_KEY_PREFIX + stateId;
    // Get the stored value for the state.
    const stateValue = localStorage.getItem(stateKey);

    // Verify that the state is active.
    if (stateValue === null) return;
    // Verify that the state is not yet used.
    if (stateValue !== '') return;

    // Get the authorization code parameter.
    const authCode = parameters['code'];
    // Verify that an authorization code was received.
    if (!authCode) return;

    // Write the state value into the local storage.
    localStorage.setItem(stateKey, authCode);

    // Update UI.
    this.processed = true;

    // Close this window now.
    window.close();
  }
}
