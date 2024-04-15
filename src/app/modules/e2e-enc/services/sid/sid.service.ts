import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { NonceGenerators } from 'oidc-squared';
import { firstValueFrom } from 'rxjs';

import { base64ToBase64url, base64urlToBase64, decodeBase64url } from './../../../../../app/byte-array-converter';
import { Identity, IdentityService } from '../../../authentication';
import { SessionRequestJwt } from '../../types/session-request-jwt.type';
import { BASE_PATH } from '../../types/variables';

@Injectable({
  providedIn: 'root',
})
export class SidService {
  private readonly defaultHeaders = new HttpHeaders();
  private state = '';

  /**
  * Gets identity with which to authenticate against resource server.
  */
  public get clientIdentity(): Identity {
    return this.identityService.identities[0];
  }

  /**
   * Constructs a new Sid Service Instance
   * @param basePath baseURL of resource server
   * @param httpClient HttpClient Instance.
   * @param identityService Identity Service instance
   */
  constructor(
    @Inject(BASE_PATH) private readonly basePath: string,
    private readonly httpClient: HttpClient,
    private readonly identityService: IdentityService,
  ) { }

  /**
   * Generate a new key pair K_C±
   * @returns a new key pair (ECDSA, P-384)
   */
  public async genKeyPair(): Promise<CryptoKeyPair> {
    // Generate new key pair.
    return await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-384' },
      true,
      [ 'sign', 'verify' ],
    );
  }

  /**
   * Generate new Diffie-Hellman parameters
   * @returns new Dh parameters that can be used to derive a key
   */
  public async genDhParams(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [ 'deriveKey' ],
    );
  }

  /**
   * Requests an Identity Certification Token.
   * @param identity Identity to request ICT for.
   * @param keyPair Asymmetric authentication key pair.
   * @param claims Identity claims to request.
   * @returns Obtained Identity Certification Token.
   */
  public async reqIct(identity: Identity, keyPair: CryptoKeyPair, claims: string[]): Promise<string> {
    return await this.identityService.requestIct(
      identity,
      keyPair,
      claims,
    );
  }

  /**
   * Binary String to URL-Safe Base64
   */
  private binToUrlBase64(bin: string) {
    return btoa(bin)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+/g, '');
  }

  private uint8ToUrlBase64(uint8: Uint8Array) {
    var bin = '';
    uint8.forEach((code: any) => {
      bin += String.fromCharCode(code);
    });
    return this.binToUrlBase64(bin);
  }

  /**
   * Generates a JWT that will be sent to the server in the payload of a session request
   * @param keyPair client's asymmetric keypair
   * @param ict client's ICT for current identity
   * @param clientDHMac client's public DH parameter for message authentication
   * @param clientDHEnc client's public DH parameter for encryption
   * @param mode The mode that the client wants to use ('ratchet'|'tls')
   */
  public async genSessionJwt(
    keyPair: CryptoKeyPair,
    ict: string,
    clientDHMac: CryptoKey,
    clientDHEnc: CryptoKey,
    mode: string,
  ): Promise<string> {
    const dhMacJWK = await crypto.subtle.exportKey('jwk', clientDHMac);
    const dhEncJWK = await crypto.subtle.exportKey('jwk', clientDHEnc);
    this.state = NonceGenerators.uuid().generate();

    var header = {
      'alg': 'ES384',
      'typ': 'JWT',
    };
    var payload = {
      'ict': ict,
      'dhMac': dhMacJWK,
      'dhEnc': dhEncJWK, 
      'state': this.state,
      'mode': mode,
    };

    var enc = new TextEncoder();

    const encJWT = base64ToBase64url(btoa(JSON.stringify(header)))
                 + '.'
                 + base64ToBase64url(btoa(JSON.stringify(payload)));
    const signature: ArrayBuffer = await crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-384' } },
      keyPair.privateKey,
      enc.encode(encJWT),
    );
    const base64Signature = this.uint8ToUrlBase64(new Uint8Array(signature));
    return encJWT + '.' + base64Signature;
  }

  /**
   * Send POST request to /sid server endpoint with the requestJwt in body
   * Expected response is a valid sessionToken
   * @param sessionRequestJwt 
   * @returns 
   */
  public async requestSession(sessionRequestJwt: SessionRequestJwt): Promise<any> {
    const headers = this.defaultHeaders.set('Content-Type', 'text/plain; charset=utf-8');
    return await firstValueFrom(
      this.httpClient.post(
        this.basePath + '/sid',
        sessionRequestJwt,
        {
          headers,
          responseType: 'text'
        },
      ),
    );
  }

  /**
   * Verify workload identity JWT using the server PKI's public key
   * If workload identity could be verified, extract K_S+ from certificate
   * @returns serverPublicKey if signature could be verified, otherwise undefined
  */
  private async verifyWorkloadId(workloadId: string): Promise<CryptoKey|undefined> {
    let enc = new TextEncoder();
    const pkiPublicKeyJwk = await firstValueFrom(
      this.httpClient.get(
        this.basePath + '/.well-known/pki-configuration',
      ),
    );

    const pkiPublicKey: CryptoKey = await crypto.subtle.importKey(
      'jwk', 
      pkiPublicKeyJwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: "SHA-512" },
      true,
      [ 'verify' ],
    );

    var jwtParts: string[] = workloadId.split(".");
    var signatureBase64: string = base64urlToBase64(jwtParts[2]);
    var signature = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));
    var signatureInput: ArrayBuffer = enc.encode(jwtParts[0]+ "." +jwtParts[1]);

    let verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      pkiPublicKey,
      signature,
      signatureInput,
    );

    if (!verified) {
      console.log('Workload ID could not be verified');
      return undefined;
    }

    console.log('Workload ID verified');
    let jwtBody = JSON.parse(atob(jwtParts[1]));
    let serverPublicKeyJwk = jwtBody['jwk'];
    const serverPublicKey: CryptoKey = await crypto.subtle.importKey(
      'jwk',
      serverPublicKeyJwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: "SHA-512" },
      true,
      [ 'verify' ],
    );
    
    return serverPublicKey;
  }

  /**
   * Verify response JWT signature and state using server public key and given this.state
   * @param responseJwt response from server, signed with K_S+
   * @param serverPublicKey server's public key K_S+
   * @returns true if response signature could be verified, false otherwise
   */
  private async verifyResponseSignature(responseJwt: string, serverPublicKey: CryptoKey): Promise<Boolean>{
    const enc = new TextEncoder();
    const jwtParts: string[] = responseJwt.split('.');
    const signatureBase64: string = jwtParts[2];
    const signature: Uint8Array = decodeBase64url(signatureBase64);

    const verified: boolean = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      serverPublicKey,
      signature,
      enc.encode(jwtParts[0] + '.' + jwtParts[1]),
    );
    
    return verified;
  }

  /**
   * Extract server's DH parameters from server response
   * @param responseJwt
   * @returns server's DH parameters as an array of CryptoKeys
  */
  private async getServerDhParams(body: any): Promise<CryptoKey[]|undefined[]> {
    const serverDhMacJwk = JSON.parse(body['dhMac']);
    const serverDhEncJwk = JSON.parse(body['dhEnc']);

    const serverDhMac = await crypto.subtle.importKey(
      'jwk',
      serverDhMacJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      [ 'deriveKey' ],
    );
    const serverDhEnc = await crypto.subtle.importKey(
      'jwk',
      serverDhEncJwk,
      { name: 'ECDH', namedCurve: "P-256" },
      true,
      [ 'deriveKey' ],
    );
    
    return [ serverDhMac, serverDhEnc ];
  }

  /**
   * Parse session response, verify signatures and compute DH secret
   * @param responseJwt response from server containing all relevant session information and workload identity
   * @returns Server's public DH keys (for MAC and enc)
   */
  public async verifyResponse(responseJwt: string): Promise<CryptoKey[]|undefined[]> {
    const jwtParts: string[] = responseJwt.split(".");
    const jwtBody: string = jwtParts[1];
    const bodyAsJson = JSON.parse(atob(jwtBody));
    const serverPublicKey = await this.verifyWorkloadId(bodyAsJson["workloadId"]);
    if (serverPublicKey) { 
      if (!this.verifyResponseSignature(responseJwt, serverPublicKey)) {
        throw 'Session Response Token could not be verified';
      }
      else {
        console.log("Session Response Token verified");
      }
    } else {
      return [ undefined, undefined ];
    }

    if (this.state != bodyAsJson['state']) {    // returned state is different from local state
        return [undefined, undefined];
    }
    this.state = '';
    const dhServerParams = await this.getServerDhParams(bodyAsJson);
    return dhServerParams;
  }

  /** Derive DH shared secret for HMAC sign/verify
   * @params privateKey
   * @params publicKey
   * @params salt: random ArrayBuffer value with length 32 byte
   * @return DH secret CryptoKey
   */
  public async calcDhMacSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
    // Derive a ECDH key which will be used as input to the HKDF alorithm to derive a HMAC key
    const baseKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      privateKey,
      { name: 'HKDF', hash: "SHA-256", salt: new ArrayBuffer(0), info: new ArrayBuffer(0) },
      false,
      [ 'deriveKey' ],
    );

    return await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new Uint8Array(0) },
      baseKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      [ 'sign', 'verify' ],
    );
  }

  /** Derive DH shared secret for encrypting/decrypting
   * @params privateKey
   * @params publicKey
   * @return DH secret CryptoKey
   */
  public async calcDhEncSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      [ 'encrypt', 'decrypt' ],
    );
  }

  public getSessionToken(responseJwt: string): string {
    const jwtParts: string[] = responseJwt.split('.');
    const jwtBody: string = jwtParts[1];
    const bodyAsJson = JSON.parse(atob(jwtBody));
    return bodyAsJson['sessionToken'];
  }

  public getExp(responseJwt: string): number {
    const jwtParts: string[] = responseJwt.split('.');
    const jwtBody: string = jwtParts[1];
    const bodyAsJson = JSON.parse(atob(jwtBody));
  
    return bodyAsJson['exp'];
  }
}
