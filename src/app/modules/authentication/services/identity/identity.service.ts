import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as jose from 'jose';
import { firstValueFrom } from 'rxjs';

import { encodeBase64url } from '../../../../byte-array-converter';
import { Identity } from '../../classes/identity/identity.class';
import { IdentityProvider } from '../../classes/identity-provider/identity-provider.class';
import { OAUTH_AUTH_CODE_KEY_PREFIX } from '../../pages/oidc-redirect/oidc-redirect.component';
import { AuthenticationOptions } from '../../classes/authentication-options/authentication-options';

@Injectable({
  providedIn: 'root',
})
export class IdentityService {
  /**
   * Internal array of identities.
   */
  private readonly _identities: Identity[] = [];
  /**
   * Gets an unmodifiable array of identities.
   */
  public get identities(): Identity[] {
    return [...this._identities];
  }

  /**
   * Internal array of identity providers.
   */
  private readonly _identityProviders: IdentityProvider[];

  /**
   * Gets an unmodifiable array of identity providers.
   */
  public get identityProviders(): IdentityProvider[] {
    return [...this._identityProviders];
  }

  /**
   * Constructs a new Identity Service.
   * @param http HTTP Client instance.
   */
  constructor(
    private readonly http: HttpClient,
    private readonly authenticationOptions: AuthenticationOptions,
  ) {
    this._identityProviders = authenticationOptions.identityProviders;
  }

  /**
   * Generates a random string.
   * @param byteLength Length of the string in bytes.
   * @returns Random String.
   */
  private generateRandomString(byteLength: number = 16): string {
    const arrayBuffer = new Uint8Array(byteLength);
    const randomBytes = crypto.getRandomValues(arrayBuffer);
    return encodeBase64url(randomBytes);
  }

  /**
   * Loads a Discovery Document for an Identity Provider.
   * @param identityProvider Identity Provider.
   * @returns Discovery Document.
   */
  private async loadDiscoveryDocument(identityProvider: IdentityProvider): Promise<Record<string, any>> {
    return await firstValueFrom(
      this.http.get<Record<string, any>>(
        identityProvider.baseUrl + '/.well-known/openid-configuration',
      ),
    );
  }

  /**
   * Computes a PKCE Code Callenge from a PKCE Code Verifier.
   * @param verifier Code Verifier.
   * @returns Code Challenge
   */
  private async computePkceCodeChallenge(verifier: string): Promise<string> {
    const verifierLength = verifier.length;
    const charCodes = [];
    for (let i = 0; i < verifierLength; i++) {
      charCodes.push(verifier.charCodeAt(i));
    }
    const ascii = Uint8Array.from(charCodes);
    const hash = await crypto.subtle.digest('SHA-256', ascii);
    return encodeBase64url(new Uint8Array(hash));
  }

  /**
   * Requests an Authorization Code by performing an Authorization Code Flow.
   * @param options Authorization Code Request Options.
   * @returns Authorization Code.
   */
  private async requestAuthorizationCode(options: {
    state: string,
    redirectUri: string,
    clientId: string,
    pkceChallenge: string,
    scopes: string[],
    authorizationEndpoint: string,
    timeout?: number,
    refreshInterval?: number
  }): Promise<string> {
    // Generate the key of the local storage variable where the OauthCallbackComponent will write the 
    const stateKey = OAUTH_AUTH_CODE_KEY_PREFIX + options.state;
    // Ensure that the state is not yet in use.
    if (localStorage.getItem(stateKey) !== null) throw new Error('State is already in use!');
    // Write an empty string to the local storage to reserve the state.
    localStorage.setItem(stateKey, '');

    try {
      // Prepare Authorization URL.
      const requestParams = new URLSearchParams({
        response_type: 'code',
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        scope: options.scopes.join(' '),
        state: options.state,
        code_challenge: options.pkceChallenge,
        code_challenge_method: 'S256',
      });

      // Open authorization code flow in a new tab.
      window.open(options.authorizationEndpoint + '?' + requestParams.toString(), '_blank')?.focus();

      return await Promise.race([
        // Timeout promise.
        new Promise<string>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Auth Flow timed out!'));
          }, options.timeout ?? 600000);
        }),
        // Promise which regularly checks for the authorization code in the local storage.
        new Promise<string>((resolve, reject) => {
          const interval = setInterval(() => {
            // Request the authorization code from the local storage.
            const authCode = localStorage.getItem(stateKey);

            if (authCode === null) {
              // No entry found -> Authorization code was already processed.
              clearInterval(interval);
              reject(new Error('Auth Flow expired!'));
            } else if (authCode !== '') {
              // Authorization code received -> resolve it.
              clearInterval(interval);
              resolve(authCode);
            } else {
              // Nothing to do here -> continue.
            }
          }, options.refreshInterval ?? 1000);
        }),
      ]);
    } catch (e) {
      throw new Error('Failed to obtain Authorization Code: ' + e);
    } finally {
      // Unregister from local storage.
      localStorage.removeItem(stateKey);
    }
  }

  /**
   * Performs an OAuth 2 Access Token Request.
   * @param options Request Token Options.
   * @returns Token Response.
   */
  private async requestTokens(options: {
    tokenEndpoint: string,
    clientId: string,
    clientSecret?: string,
    pkceVerifier: string,
    authorizationCode: string,
    redirectUri: string,
  }): Promise<Record<string, any>> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.authorizationCode,
      redirect_uri: options.redirectUri,
      client_id: options.clientId,
      code_verifier: options.pkceVerifier,
    });
    if (options.clientSecret) {
      body.append('client_secret', options.clientSecret);
    }

    return await firstValueFrom(
      this.http.post<Record<string, any>>(options.tokenEndpoint, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );
  }

  /**
   * Performs a login to an identity.
   * @param identityProvider Identity provider to login to.
   * @param scopes OAuth Scopes to request.
   */
  public async login(identityProvider: IdentityProvider, scopes?: string[]): Promise<Identity> {
    // Load Discovery Document.
    const discoveryDocument = await this.loadDiscoveryDocument(identityProvider);

    // Prepare Authorization Request Parameter.
    const pkceVerifier = this.generateRandomString(32);
    const pkceChallenge = await this.computePkceCodeChallenge(pkceVerifier);
    const redirectUri = window.location.origin + '/oidc-redirect';

    // Perform Authorization Request.
    const authorizationCode = await this.requestAuthorizationCode({
      clientId: identityProvider.clientId,
      redirectUri: redirectUri,
      state: this.generateRandomString(16),
      pkceChallenge: pkceChallenge,
      authorizationEndpoint: discoveryDocument['authorization_endpoint'],
      scopes: scopes ?? identityProvider.scopes ?? [],
    });

    // Perform Token Request.
    const tokens = await this.requestTokens({
      tokenEndpoint: discoveryDocument['token_endpoint'],
      clientId: identityProvider.clientId,
      clientSecret: identityProvider.clientSecret,
      pkceVerifier: pkceVerifier,
      authorizationCode: authorizationCode,
      redirectUri: redirectUri,
    });

    // Extract the Access Token, Refresh Token, and identity claims from the ID Token.
    const accessToken = tokens['access_token'];
    const accessTokenExpiry = new Date(Date.now() + tokens['expires_in'] * 1000);
    const refreshToken = tokens['refresh_token'];
    const idToken = tokens['id_token'];
    const identityClaims = jose.decodeJwt(idToken);

    // Create identity instance.
    const identity = new Identity(
      identityClaims,
      identityProvider,
      accessToken,
      accessTokenExpiry,
      refreshToken,
    );

    // Remove the identity instance from identities after logout.
    firstValueFrom(identity.onLogout).then(() => {
      const index = this._identities.indexOf(identity);
      this._identities.splice(index, 1);
    });
    // Add the identity to the array of identities.
    this._identities.push(identity);

    return identity;
  }
}
