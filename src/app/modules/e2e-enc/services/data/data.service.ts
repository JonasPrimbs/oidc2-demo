import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { decodeBase64, encodeBase64 } from '../../../../byte-array-converter';
import { BASE_PATH } from '../../types/variables';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  /**
   * The default headers to always set for the service.
   */
  private readonly defaultHeaders = new HttpHeaders();

  /**
   * A service to interact with the data backend.
   * @param basePath The base path of the End-to-End Encryption backend.
   * @param httpClient The HTTP client instance.
   */
  constructor(
    @Inject(BASE_PATH) private readonly basePath: string,
    private readonly httpClient: HttpClient,
  ) { }

  /**
   * Encrypt a given ArrayBuffer using DH shared encryption secret
   * @param data ArrayBuffer to be decrypted
   * @param secret shared DH secret for encrypting
   * @returns base64 encoded ciphertext string
   */
  public async dataEncrypt(data: ArrayBuffer, secret: CryptoKey): Promise<string> {
    // Create random initialization vector.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    // Encrypt file using secret and initialization vector.
    var cipher: ArrayBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      secret,
      data,
    );
    
    // Prepend the iv to the ciphertext and return as Base64 string
    const cipherBuffer: Uint8Array = new Uint8Array(cipher);
    const ivBuffer: Uint8Array = new Uint8Array(iv);
    const buffer: Uint8Array = new Uint8Array(ivBuffer.length + cipherBuffer.length);
    buffer.set(ivBuffer);
    buffer.set(cipherBuffer, ivBuffer.length);

    return encodeBase64(buffer);
  }

  /**
   * Delete a file on the server
   */
  public async dataDelete(
    sessionToken: string,
    publicDHMac: string,
    publicDHEnc: string,
    body: string,
    signature: string,
  ): Promise<any> {
    // Ensure that body is not empty.
    if (!body) {
      throw new Error('Required parameter body was null or undefined when calling dataDelete.');
    }

    // Set headers.
    const headers = this.defaultHeaders
      .set('x-e2e-session', sessionToken)
      .set('Content-Type', "text/plain; charset=utf-8")
      .set('x-publicKeyMac', publicDHMac)
      .set('x-publicKeyEnc', publicDHEnc)
      .set('Signature', signature);

    // Send delete request.
    return await firstValueFrom(
      this.httpClient.delete(
        this.basePath + '/data', {
          headers: headers,
          responseType: 'text',
          observe: 'response',
          body: body,
        },
      ),
    );
  }

  /**
   * Download file from server.
   */
  public async dataGet(
    sessionToken: string,
    publicDHMac: string,
    publicDHEnc: string,
    body: string,
    signature: string,
  ): Promise<any> {
    if (!body) {
      throw new Error('Required parameter body was null or undefined when calling dataDelete.');
    }

    const headers = this.defaultHeaders
      .set('x-e2e-session', sessionToken)
      .set('Content-Type', "text/plain; charset=utf-8")
      .set('x-publicKeyMac', publicDHMac)
      .set('x-publicKeyEnc', publicDHEnc)
      .set('Signature', signature)
      .set('x-filename', body); // since this is a get request, we store the filename in the header

    return await firstValueFrom(
      this.httpClient.get(
        this.basePath + '/data', {
          headers: headers,
          observe: 'response',
          responseType: 'arraybuffer',
        },
      ),
    );
  }

  /**
   * Calculate HMAC signature value covering relevant http headers and body value
   * @param key to calculate MAC value
   * @param requestTarget request target string (e.g. "post /data")
   * @param authorization sessionToken string
   * @param contentType content-type value
   * @param publicKeyMac public DH key for generating MAC
   * @param publicKeyEnc public DH key for encryption
   * @param body base64 string value of http body
   * @returns base64 encoded HMAC of signature input
   */
  public async genSignatureHeader(
    key: CryptoKey,
    requestTarget: string,
    authorization: string,
    contentType: string,
    publicKeyMac: string,
    publicKeyEnc: string,
    body: string,
  ): Promise<string> {
    const enc = new TextEncoder();
  
    // Assemble signature input
    const input: string = '(request-target): ' + requestTarget + '\n'
      + 'host: ' + this.basePath + '\n'
      + 'x-e2e-session: ' + authorization + '\n'
      + 'content-type: ' + contentType + '\n'
      + 'x-publickeymac: ' + publicKeyMac + '\n'
      + 'x-publickeyenc: ' + publicKeyEnc + '\n'
      + 'body: ' + body;

    const encoded = enc.encode(input);
    const signature = await crypto.subtle.sign('HMAC', key, encoded);
    const buffer: Uint8Array = new Uint8Array(signature);

    return encodeBase64(buffer);
  }

  /**
   * Upload encrypted data to server
   * @param sessionToken an encrypted token received from server that contains all session parameters
   * @param publicDHMac client public DH Mac JWK string (undefined in tls mode)
   * @param publicDHEnc client public DH Enc JWK string (undefined in tls mode)
   * @param body Contains encrypted and base64 encoded data
   */
  public async postFile(
    sessionToken: string,
    publicDHMac: string,
    publicDHEnc: string,
    body: string,
    signature: string,
  ): Promise<any> {
    if (!body) {
      throw new Error('Required parameter body was null or undefined when calling postFile.');
    }

    const headers = this.defaultHeaders
      .set('x-e2e-session', sessionToken)
      .set('Content-Type', "text/plain; charset=utf-8")
      .set('x-publicKeyMac', publicDHMac)
      .set('x-publicKeyEnc', publicDHEnc)
      .set('Signature', signature);

    return await firstValueFrom(
      this.httpClient.post(
        this.basePath + '/data',
        body, {
          headers,
          responseType: 'text',
          observe: 'response',
        },
      ),
    );
  }

  /**
   * Verify response HMAC.
   */
  public async verifyHttpSig(key: CryptoKey, response: Response): Promise<boolean> {
    const receivedSignature: ArrayBuffer = decodeBase64(response.headers.get('signature')!).buffer;
    const body: string = await new Response(response.body).text();
    const enc = new TextEncoder();

    const input: string = "content-type: " + response.headers.get('content-type') + '\n';
      + 'x-e2e-session: ' + (response.headers.get('x-e2e-session') ?? '') + '\n';
      + 'x-publickeymac: ' + (response.headers.get('x-publickeymac') ?? '') + '\n';
      + 'x-publickeyenc: ' + (response.headers.get('x-publickeyenc') ?? '') + '\n';
      + 'x-exp: ' + (response.headers.get('x-exp') ?? '') + '\n';
      + 'body: ' + body + '\n';

    const encoded = enc.encode(input);
    return await crypto.subtle.verify('HMAC', key, receivedSignature, encoded);
  }

  /**
   * Decrypt and write file with filename.
   */
  public async decryptWriteFile(filename: string, ciphertext: string, key: CryptoKey): Promise<void> {
    const rawCipherBytes: ArrayBuffer = decodeBase64(ciphertext).buffer;
    const iv: ArrayBuffer = rawCipherBytes.slice(0, 12);
    const cipher: ArrayBuffer = rawCipherBytes.slice(12);

    const plainBytes: ArrayBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      cipher,
    );

    const fileContent: Uint8Array = new Uint8Array(plainBytes);

    // Save file
    const file = new Blob([fileContent], { type: 'text/plain'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
    link.remove();
  }
}
