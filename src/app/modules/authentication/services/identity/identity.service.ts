import { HttpClient } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import * as jose from 'jose';
import { firstValueFrom } from 'rxjs';
import { SignPoPToken } from 'oidc-squared';
import { ICTResponse } from 'oidc-squared/dist/rest';

import { encodeBase64url } from '../../../../byte-array-converter';
import { AuthenticationOptions } from '../../classes/authentication-options/authentication-options.class';
import { Identity } from '../../classes/identity/identity.class';
import { IdentityProvider } from '../../classes/identity-provider/identity-provider.class';
import { OAUTH_AUTH_CODE_KEY_PREFIX } from '../../pages/oidc-redirect/oidc-redirect.component';
import { E2ePopClaims } from '../../types/e2e-pop-claims.interface';
import { SignE2EPoPPGPToken } from '../../types/e2e-pop-pgp-token.interface';
import { E2ePopPgpClaims } from '../../types/e2e-pop-pgp-claims.interface';

@Injectable({
  providedIn: 'root',
})
export class IdentityService {
  
  public readonly identitiesChanged = new EventEmitter<void>();

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
   * @param authenticationOptions Authentication Options.
   */
  constructor(
    private readonly http: HttpClient,
    authenticationOptions: AuthenticationOptions,
  ) {
    this._identityProviders = authenticationOptions.identityProviders;
  }

  /**
   * Generates a random string.
   * @param byteLength Length of the string in bytes.
   * @returns Random String.
   */
  public generateRandomString(byteLength: number = 16): string {
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

    const requestScopes = scopes ?? identityProvider.scopes ?? [];

    // Perform Authorization Request.
    const authorizationCode = await this.requestAuthorizationCode({
      clientId: identityProvider.clientId,
      redirectUri: redirectUri,
      state: this.generateRandomString(16),
      pkceChallenge: pkceChallenge,
      authorizationEndpoint: discoveryDocument['authorization_endpoint'],
      scopes: requestScopes,
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
      requestScopes,
      refreshToken,
    );

    // Remove the identity instance from identities after logout.
    firstValueFrom(identity.onLogout).then(() => {
      const index = this._identities.indexOf(identity);
      this._identities.splice(index, 1);
      this.identitiesChanged.emit();
    });
    // Add the identity to the array of identities.
    this._identities.push(identity);
    this.identitiesChanged.emit();

    return identity;
  }

  /**
   * Generates a Proof-of-Possession Token.
   * @param identity Identity.
   * @param keyPair Asymmetric signing key pair.
   * @param claims Identity claims.
   * @returns PoP Token.
   */
  private async generatePoPToken(identity: Identity, keyPair: CryptoKeyPair) {
    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const popToken = new SignPoPToken();
    return await popToken
      .setPublicKey('ES384', publicKey)
      .setIssuer(identity.identityProvider.clientId)
      .setSubject(identity.claims.sub!)
      .setAudience(identity.identityProvider.baseUrl)
      .sign(keyPair.privateKey);
  }

  /**
   * Requests an Identity Certification Token.
   * @param identity Identity to request ICT for.
   * @param keyPair Asymmetric authentication key pair.
   * @param claims Identity claims to request.
   * @returns Obtained Identity Certification Token.
   */
  public async requestIct(identity: Identity, keyPair: CryptoKeyPair, claims: string[]): Promise<string> {
    // Generate PoP Token.
    const popToken = await this.generatePoPToken(identity, keyPair);

    // Send ICT Token Request.
    const ictEndpoint = identity.identityProvider.baseUrl + '/protocol/openid-connect/ict';
    const result = await firstValueFrom(
      this.http.post<ICTResponse>(
        ictEndpoint,
        popToken,
        {
          headers: {
            'Content-Type': 'application/jwt',
            'Authorization': `bearer ${identity.accessToken}`,
          },
        },
      ),
    );

    return result.identity_certification_token;
  }

  /**
   * Generates an End-to-End Proof-of-Possession Token.
   * @param keyPair Key Pair whose private key is used to sign the token and whose public key is used to generate the JWK Thumbprint with.
   * @param claims Claims of the payload.
   * @returns Generated End-to-End Proof-of-Possession Token.
   */
  public async generateE2ePoP(keyPair: CryptoKeyPair, claims: E2ePopPgpClaims | E2ePopClaims): Promise<string> {
    const jkt = await jose.calculateJwkThumbprint(
      await jose.exportJWK(keyPair.publicKey),
      'sha256',
    );
    
    let e2ePopToken = new SignE2EPoPPGPToken()
      .setThumbprint('ES384', jkt)
      .setIssuer(claims.iss)
      .setSubject(claims.sub)
      .setAudience(claims.aud);
    
    if(claims.pgp_fingerprint){
      e2ePopToken.setPgpFingerprint(claims.pgp_fingerprint);
    }

    return await e2ePopToken
      .sign(keyPair.privateKey);
  }
}
