/**
 * Endpoint for establishing and maintaining an encrypted client-server session
 * This endpoint establishes an end-to-end encrypted client-server session after authenticating the client with its Id Certification Token (Client_ICT). After the successful exchange of DH parameters, the client can communicate with the server, upload, download or delete files on the server with all communication being encrypted on application layer.
 *
 * OpenAPI spec version: 0.1
 * 
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 *//* tslint:disable:no-unused-variable member-ordering */

import { Inject, Injectable, Optional }                      from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams,
         HttpResponse, HttpEvent }                           from '@angular/common/http';
import { CustomHttpUrlEncodingCodec }                        from '../../encoder';

import { Observable }                                        from 'rxjs';


import { BASE_PATH, COLLECTION_FORMATS }                     from '../../variables';
import { Configuration }                                     from '../../configuration';
import { encodeBase64, decodeBase64 } from 'src/app/byte-array-converter';


@Injectable({
    providedIn: 'root'
  })
export class DataService {

    protected basePath = 'http://localhost:4040';
    public defaultHeaders = new HttpHeaders();
    public configuration = new Configuration();

    constructor(protected httpClient: HttpClient, @Optional()@Inject(BASE_PATH) basePath: string, @Optional() configuration: Configuration) {
        if (basePath) {
            this.basePath = basePath;
        }
        if (configuration) {
            this.configuration = configuration;
            this.basePath = basePath || configuration.basePath || this.basePath;
        }
    }

    /** Encrypt a given ArrayBuffer using DH shared encryption secret
     * @param data ArrayBuffer to be decrypted
     * @param secret shared DH secret for encrypting
     * @returns base64 encoded ciphertext string
     */
    public async dataEncrypt(data: ArrayBuffer, secret: CryptoKey): Promise<string> {
        // create random iv
        var iv = crypto.getRandomValues(new Uint8Array(12));

        // encrypt file using secret and iv
        var cipher: ArrayBuffer = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            secret,
            data
        );
        
        // Prepend the iv to the ciphertext and return as Base64 string
        var cipherBuffer: Uint8Array = new Uint8Array(cipher);
        var ivBuffer: Uint8Array = new Uint8Array(iv);
        var buffer: Uint8Array = new Uint8Array(ivBuffer.length + cipherBuffer.length);
        buffer.set(ivBuffer);
        buffer.set(cipherBuffer, ivBuffer.length);

        return encodeBase64(buffer);
    }

    /**
     * Delete a file on the server
     */
    public dataDelete(sessionToken: string,
                      publicDHMac: string,
                      publicDHEnc: string,
                      body: string,
                      signature: string): Observable<any> {
        if (body === null || body === undefined) {
            throw new Error('Required parameter body was null or undefined when calling dataDelete.');
        }

        let headers = this.defaultHeaders;
        headers = headers.set('x-e2e-session', sessionToken);
        headers = headers.set('Content-Type', "text/plain; charset=utf-8");
        headers = headers.set('x-publicKeyMac', publicDHMac);
        headers = headers.set('x-publicKeyEnc', publicDHEnc);
        headers = headers.set('Signature', signature);
        return this.httpClient.delete(this.basePath+'/data',
            {
                headers: headers,
                responseType: 'text',
                observe: 'response',
                body: body
            }
        );
    }

    /**
     * Download file from server
     * @param 
     */
    public dataGet(sessionToken: string,
                   publicDHMac: string,
                   publicDHEnc: string,
                   body: string,
                   signature: string): Observable<any> {
        if (body === null || body === undefined) {
            throw new Error('Required parameter body was null or undefined when calling dataDelete.');
        }

        let headers = this.defaultHeaders;
        headers = headers.set('x-e2e-session', sessionToken);
        headers = headers.set('Content-Type', "text/plain; charset=utf-8");
        headers = headers.set('x-publicKeyMac', publicDHMac);
        headers = headers.set('x-publicKeyEnc', publicDHEnc);
        headers = headers.set('Signature', signature);
        headers = headers.set('x-filename', body);    // since this is a get request, we store the filename in the header
        return this.httpClient.get(this.basePath+'/data',
            {
                headers: headers,
                observe: 'response',
                responseType: 'arraybuffer'
            }
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
    public async genSignatureHeader(key: CryptoKey,
                                    requestTarget: string,
                                    authorization: string,
                                    contentType: string,
                                    publicKeyMac: string,
                                    publicKeyEnc: string,
                                    body: string): Promise<string> {
        let enc = new TextEncoder();
    
        // Assemble signature input
        var input: string = "(request-target): " + requestTarget + "\n";
        input = input + "host: " + this.basePath + "\n";
        input = input + "x-e2e-session: " + authorization + "\n";
        input = input + "content-type: " + contentType + "\n";
        input = input + "x-publickeymac: " + publicKeyMac + "\n";
        input = input + "x-publickeyenc: " + publicKeyEnc + "\n";
        input = input + "body: " + body;

        let encoded = enc.encode(input);
        let signature = await crypto.subtle.sign("HMAC", key, encoded);
        let buffer: Uint8Array = new Uint8Array(signature);

        return encodeBase64(buffer);
    }
    /**
     * Upload encrypted data to server
     * @param sessionToken an encrypted token received from server that contains all session parameters
     * @param publicDHMac client public DH Mac JWK string (undefined in tls mode)
     * @param publicDHEnc client public DH Enc JWK string (undefined in tls mode)
     * @param body Contains encrypted and base64 encoded data
     */
    public postFile(sessionToken: string,
                    publicDHMac: string,
                    publicDHEnc: string,
                    body: string,
                    signature: string): Observable<any> {
        if (body === null || body === undefined) {
            throw new Error('Required parameter body was null or undefined when calling postFile.');
        }

        let headers = this.defaultHeaders;
        headers = headers.set('x-e2e-session', sessionToken);
        headers = headers.set('Content-Type', "text/plain; charset=utf-8");
        headers = headers.set('x-publicKeyMac', publicDHMac);
        headers = headers.set('x-publicKeyEnc', publicDHEnc);
        headers = headers.set('Signature', signature);
        return this.httpClient.post(this.basePath+'/data', body,
            {
                headers,
                responseType: 'text',
                observe: 'response'
            }
        );
    }

    // Verify response HMAC
    public async verifyHttpSig(key: CryptoKey, response: Response): Promise<boolean> {
        let receivedSignature: ArrayBuffer = decodeBase64(response.headers.get('signature')!).buffer;
        let body: string = await new Response(response.body).text();
        let enc = new TextEncoder();

        var input: string = "content-type: " + response.headers.get('content-type')  + "\n";
        input = input + "x-e2e-session: "    + response.headers.get('x-e2e-session') + "\n";
        input = input + "x-publickeymac: "     + response.headers.get('x-publickeymac')  + "\n";
        input = input + "x-publickeyenc: "     + response.headers.get('x-publickeyenc')  + "\n";
        input = input + "x-exp: "              + response.headers.get('x-exp')           + "\n";
        input = input + "body: "             + body                                  + "\n";

        /* DEBUGGING 
        var keyString: string = encodeBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
        console.log("Signature input: ", encodeBase64(enc.encode(input)));
        console.log("Signature key: ", keyString);*/

        let encoded = enc.encode(input);
        return await crypto.subtle.verify("HMAC", key, receivedSignature, encoded);
    }

    // Decrypt and return sessionToken
    // Deprecated!
    /*public async decryptSessionToken(ciphertext: string, key: CryptoKey): Promise<string> {
        const rawCipherBytes: ArrayBuffer = decodeBase64(ciphertext).buffer;
        const iv: ArrayBuffer = rawCipherBytes.slice(0, 12);
        const cipher: ArrayBuffer = rawCipherBytes.slice(12);

         /* DEBUGGING
         var enc = new TextEncoder();
         var keyString: string = encodeBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
         console.log("SessionToken decryption key: ", keyString);

        const plainBytes: ArrayBuffer = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            cipher
        );
        let buffer: Uint8Array = new Uint8Array(plainBytes);

        return new TextDecoder().decode(buffer);
    }*/

    // Decrypt and write file with filename
    public async decryptWriteFile(filename: string, ciphertext: string, key: CryptoKey): Promise<void> {
        const rawCipherBytes: ArrayBuffer = decodeBase64(ciphertext).buffer;
        const iv: ArrayBuffer = rawCipherBytes.slice(0, 12);
        const cipher: ArrayBuffer = rawCipherBytes.slice(12);

        /* DEBUGGING
        var enc = new TextEncoder();
        var keyString: string = encodeBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
        console.log("File decryption key: ", keyString); */

        const plainBytes: ArrayBuffer = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            cipher
        );
        let fileContent: Uint8Array = new Uint8Array(plainBytes);
        
        // save file
        const file = new Blob([fileContent], {type: "text/plain"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = filename;
        link.click();
        link.remove();
    }
}
