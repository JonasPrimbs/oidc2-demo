import { Component } from '@angular/core';

import { encodeBase64 } from '../../../byte-array-converter';
import { IdentityService } from '../../authentication';
import { DataService } from '../services/data/data.service';
import { PingService } from '../services/ping/ping.service';
import { SidService } from '../services/sid/sid.service';

@Component({
  selector: 'e2e-enc',
  templateUrl: './e2e-enc.component.html',
  styleUrls: ['./e2e-enc.component.scss'],
})
export class E2EEncComponent {
  private ict: string = '';
  private clientDHMac: CryptoKeyPair | undefined;
  private clientDHEnc: CryptoKeyPair | undefined;
  private newIterClientDHMac: CryptoKeyPair | undefined;  // for ratchet mode
  private newIterClientDHEnc: CryptoKeyPair | undefined;

  private sharedDHMacSecret: CryptoKey | undefined;
  private sharedDHEncSecret: CryptoKey | undefined;
  private newIterSharedDHMacSecret: CryptoKey|undefined;  // for ratchet mode
  private newIterSharedDHEncSecret: CryptoKey|undefined;

  private sessionToken: string = "";
  private exp: number = 0;
  private timer: any;
  private endTimer: number = 0;
  public mode: 'ratchet' | 'tls' = 'ratchet';
  private fileName: string = "";

  /**
   * The countdown timer for the session expiry.
   */
  private sessionTimer: number | undefined = undefined;
  /**
   * The remaining time in seconds of the session validity.
   */
  public sessionTime: number | undefined | null = undefined;

  private start: number = 0;
  private end: number = 0;

  /**
   * Constructs a new End-to-End encrypted File Upload Page.
   * @param dataService Data Service instance.
   * @param identityService Identity Service instance.
   * @param pingService Ping Service instance.
   * @param sidService Session ID Service instance.
   */
  constructor(
    private readonly dataService: DataService,
    private readonly identityService: IdentityService,
    private readonly pingService: PingService,
    private readonly sidService: SidService,
  ) { }

  /**
   * Starts a new session with the resource server.
   */
  public async startSession(): Promise<void> {
    // Generate key pair.
    const keyPair: CryptoKeyPair = await this.sidService.genKeyPair();

    // Generate DH_C± for Diffie-Hellman (one for message authentication and one for encryption)
    this.clientDHMac = await this.sidService.genDhParams();
    this.clientDHEnc = await this.sidService.genDhParams();

    // Get ICT for current Identity
    this.ict = await this.identityService.requestIct(
      this.sidService.clientIdentity,
      keyPair,
      [ 'name', 'email', 'email_verified' ],
    );
    document.getElementById('showICT')!.setAttribute(
      'href',
      'https://jwt.io/#debugger-io?token=' + this.ict
    );
    // Create payload jwt for create session request
    const jwt = await this.sidService.genSessionJwt(
      keyPair,
      this.ict,
      this.clientDHMac.publicKey,
      this.clientDHEnc.publicKey,
      this.mode,
    );
    const response = await this.sidService.requestSession(jwt);
    this.handleSessionResponse(response);
  }

  private async handleSessionResponse(response: string) {
    const serverDhParams = await this.sidService.verifyResponse(response);
    document.getElementById('showSessionResponse')!.setAttribute('href', 'https://jwt.io/#debugger-io?token='+response);
    if (serverDhParams) {
      // Verification successful
      if (this.clientDHMac && this.clientDHEnc && serverDhParams[0] && serverDhParams[1]) {
        // All keys available, generate shared secrets and save sessionToken
        this.sharedDHMacSecret = await this.sidService.calcDhMacSecret(this.clientDHMac.privateKey, serverDhParams[0]);
        this.sharedDHEncSecret = await this.sidService.calcDhEncSecret(this.clientDHEnc.privateKey, serverDhParams[1]);
        if (this.mode == "ratchet") {
          // Ratchet mode. compute new parameters and shared mac/enc secret
          this.newIterClientDHMac = await this.sidService.genDhParams();
          this.newIterClientDHEnc = await this.sidService.genDhParams();
          this.newIterSharedDHMacSecret = await this.sidService.calcDhMacSecret(this.newIterClientDHMac.privateKey, serverDhParams[0]);
          this.newIterSharedDHEncSecret = await this.sidService.calcDhEncSecret(this.newIterClientDHEnc.privateKey, serverDhParams[1]);
        }
        // save sessionToken
        this.sessionToken = this.sidService.getSessionToken(response);
        // save sessionToken expiration date
        this.exp = this.sidService.getExp(response);
        // start refresh timer
        let now: number = Date.now();
        this.endTimer = (this.exp) * 1000 - now - 500;
        this.showCountdown(this.endTimer / 1000);
        this.timer = setTimeout(() => {
          this.refreshSessionToken();
        }, this.endTimer);
      }
    } else {
      // Abort, do nothing:
      console.error("Something went wrong. Try Start session");
    }
  }

  /** Encrypt a file array buffer and send it to the server */
  public async sendFile(file: ArrayBuffer, name: string): Promise<void> {
    // stop timer
    clearTimeout(this.timer);
    // Prepare cleartext string of format [Base64 encoded filename].[Base64 encoded file content]
    const enc = new TextEncoder();
    var nameBase64: string = encodeBase64(enc.encode(name));
    var fileBase64: string = encodeBase64(new Uint8Array(file));
    var cleartext: string = nameBase64 + "." + fileBase64;
    var encFileCont: string;

    if (this.sharedDHEncSecret && this.sharedDHMacSecret) {
      if (this.mode == "tls") { // tls mode. DH parameters don't change
        encFileCont = await this.dataService.dataEncrypt(enc.encode(cleartext), this.sharedDHEncSecret);
        console.log("encrypted File: ", encFileCont);
        // calc HTTP message signature
        let signature = await this.dataService.genSignatureHeader(
          this.sharedDHMacSecret!,
          'post /data',
          this.sessionToken,
          'text/plain; charset=utf-8',
          '',
          '',
          encFileCont,
        );
        // POST signed http request including all parameters and encrypted file
        const response = await this.dataService.postFile(
          this.sessionToken,
          '',
          '',
          encFileCont,
          signature,
        );
        this.handleDataResponse(response);
      } else {  // ratchet mode. We need to include new DH paramaters in the request
        encFileCont = await this.dataService.dataEncrypt(enc.encode(cleartext), this.newIterSharedDHEncSecret!);
        console.log("encrypted File: ", encFileCont);
        let publicDHMacJWK = await crypto.subtle.exportKey("jwk", this.newIterClientDHMac!.publicKey);
        let publicDHEncJWK = await crypto.subtle.exportKey("jwk", this.newIterClientDHEnc!.publicKey);
        let publicDHMacJWKString = JSON.stringify(publicDHMacJWK);
        let publicDHEncJWKString = JSON.stringify(publicDHEncJWK);
        // calc HTTP message signature
        let signature = await this.dataService.genSignatureHeader(
          this.sharedDHMacSecret!,
          "post /data",
          this.sessionToken,
          "text/plain; charset=utf-8",
          publicDHMacJWKString,
          publicDHEncJWKString,
          encFileCont,
        );
        // POST signed http request including all parameters and encrypted file
        const response = await this.dataService.postFile(
          this.sessionToken,
          publicDHMacJWKString,
          publicDHEncJWKString,
          encFileCont,
          signature,
        );
        this.handleDataResponse(response);
      }
    } else {
      console.log("No active session running. Try Start Session");
    }
  }

  /**
   * Handle the server's response to a POST or DELETE /data request
   */
  public async handleDataResponse(response: Response): Promise<void> {
    var secret: CryptoKey = this.sharedDHMacSecret!;
    if (this.mode == "ratchet") { // ratchet mode. Use this.newItersharedDHMacSecret
      secret = this.newIterSharedDHMacSecret!;
    }

    // verify HTTP message signature
    let verified: boolean = await this.dataService.verifyHttpSig(secret, response);
    if (!verified) {
      console.log("Could not verify response MAC");
      this.endSession();
    }

    // Extract relevant information (DH secret update only relevant in ratchet mode)
    if (this.mode == "ratchet") {
      const serverPublicMacKey: CryptoKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(response.headers.get('x-publickeymac')!),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [ 'deriveKey' ],
      );
      const serverPublicEncKey: CryptoKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(
          response.headers.get('x-publickeyenc')!,
        ),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [ 'deriveKey' ],
      );
      this.sharedDHMacSecret = await this.sidService.calcDhMacSecret(
        this.newIterClientDHMac!.privateKey,
        serverPublicMacKey,
      );
      this.sharedDHEncSecret = await this.sidService.calcDhEncSecret(
        this.newIterClientDHEnc!.privateKey,
        serverPublicEncKey,
      );
      // Create new iteration keys and secrets
      this.clientDHMac = this.newIterClientDHMac;
      this.clientDHEnc = this.newIterClientDHEnc;

      this.newIterClientDHMac = await this.sidService.genDhParams();
      this.newIterClientDHEnc = await this.sidService.genDhParams();
      this.newIterSharedDHMacSecret = await this.sidService.calcDhMacSecret(
        this.newIterClientDHMac.privateKey,
        serverPublicMacKey,
      );
      this.newIterSharedDHEncSecret = await this.sidService.calcDhEncSecret(
        this.newIterClientDHEnc.privateKey,
        serverPublicEncKey,
      );
    }

    // Update sessionToken
    this.sessionToken = response.headers.get('x-e2e-session')!;
    // Start new session refresh timer
    this.exp = Number(response.headers.get('x-exp'));
    let now: number = Date.now();
    this.endTimer = this.exp * 1000 - now - 500;
    this.showCountdown(this.endTimer / 1000);
    this.timer = setTimeout(() => {
      this.refreshSessionToken();
    }, this.endTimer);
  }

  /**
   * Handle the server's response to a GET /data request
   */
  public async handleGetResponse(response: Response): Promise<void> {
    // handle response (verify signatures, update DH parameters)
    await this.handleDataResponse(response);
    // check if session is still active (endSession() would have been called otherwise)
    if (this.sessionToken != "") {
      // decrypt response body and write to file
      await this.dataService.decryptWriteFile(this.fileName, await new Response(response.body).text(), this.sharedDHEncSecret!);
    }
  }

  /**
   * 
   * Select, encrypt and send a file to the resource server.
   * 
   */
  public async uploadFile(): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      try {
        // Create upload file selector:
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
          try {
            const placeholder = e.target as HTMLInputElement | undefined;
            if (placeholder?.files) {
              const selectedFile = placeholder.files[0];
              if (selectedFile) {
                const reader = new FileReader();
                reader.readAsArrayBuffer(selectedFile);
                reader.onloadend = async () => {
                  try {
                    const fileContent = <ArrayBuffer>reader.result;
                    this.fileName = selectedFile.name;
                    await this.sendFile(fileContent, this.fileName);
                    resolve();
                  } catch (error) {
                    reject(error);
                  }
                };
              }
            }
          } catch (error) {
            reject(error);
          }
        }
        input.click();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * TODO
   * Downloads a file from the resource server.
   * Prototype functionality: download the file that was uploaded before
   */
  public async downloadFile(): Promise<void> {
    // stop sessionToken refresh timer
    clearTimeout(this.timer);
    // ensure that a session exists and DH parameters are ready.
    if (this.sharedDHMacSecret && this.sharedDHEncSecret) {
      let enc = new TextEncoder();
      if (this.mode == "tls") { // tls mode. no need for further calculations
        // encrypt filename using the shared enc secret
        let body: string = await this.dataService.dataEncrypt(enc.encode(this.fileName), this.sharedDHEncSecret);
        let signature: string = await this.dataService.genSignatureHeader(
          this.sharedDHMacSecret,
          "get /data",
          this.sessionToken,
          "text/plain; charset=utf-8",
          "",
          "",
          body,
        );
        // send signed GET http request including all parameters and encrypted filename
        const response = await this.dataService.dataGet(
          this.sessionToken,
          '',
          '',
          body,
          signature,
        );
        await this.handleGetResponse(response);
      }
      else {  // ratchet mode. Need to calculate and include new DH parameters
        // encrypt filename using the new iteration shared enc secret
        let body: string = await this.dataService.dataEncrypt(enc.encode(this.fileName), this.newIterSharedDHEncSecret!);
        let publicDHMacJWK = await crypto.subtle.exportKey("jwk", this.newIterClientDHMac!.publicKey);
        let publicDHEncJWK = await crypto.subtle.exportKey("jwk", this.newIterClientDHEnc!.publicKey);
        let publicDHMacJWKString = JSON.stringify(publicDHMacJWK);
        let publicDHEncJWKString = JSON.stringify(publicDHEncJWK);
        let signature: string = await this.dataService.genSignatureHeader(
          this.sharedDHMacSecret,
          "get /data",
          this.sessionToken,
          "text/plain; charset=utf-8",
          publicDHMacJWKString,
          publicDHEncJWKString,
          body,
        );
        // send signed DELETE http request including all parameters and encrypted file
        const response = await this.dataService.dataGet(
          this.sessionToken,
          publicDHMacJWKString,
          publicDHEncJWKString,
          body,
          signature,
        );
        await this.handleGetResponse(response);
      }
    }
    else {
      console.log("No active session running. Try Start Session");
    }
  }

  /**
   * TODO
   * Deletes a file on the resource server.
   * Prototype functionality: delete the file that was uploaded before
   */
  public async deleteFile(): Promise<void> {
    // stop sessionToken refresh timer
    clearTimeout(this.timer);
    // ensure that a session exists and DH parameters are ready.
    if (this.sharedDHMacSecret && this.sharedDHEncSecret) {
      let enc = new TextEncoder();
      if (this.mode == "tls") { // tls mode. no need for further calculations
        // encrypt filename using the shared enc secret
        let body: string = await this.dataService.dataEncrypt(enc.encode(this.fileName), this.sharedDHEncSecret);
        let signature: string = await this.dataService.genSignatureHeader(
          this.sharedDHMacSecret,
          "delete /data",
          this.sessionToken,
          "text/plain; charset=utf-8",
          "",
          "",
          body,
        );
        // send signed DELETE http request including all parameters and encrypted filename
        const response = await this.dataService.dataDelete(
          this.sessionToken,
          "",
          "",
          body,
          signature,
        );
        await this.handleDataResponse(response);
      } else {  // ratchet mode. Need to calculate and include new DH parameters
        // encrypt filename using the new iteration shared enc secret
        let body: string = await this.dataService.dataEncrypt(enc.encode(this.fileName), this.newIterSharedDHEncSecret!);
        let publicDHMacJWK = await crypto.subtle.exportKey("jwk", this.newIterClientDHMac!.publicKey);
        let publicDHEncJWK = await crypto.subtle.exportKey("jwk", this.newIterClientDHEnc!.publicKey);
        let publicDHMacJWKString = JSON.stringify(publicDHMacJWK);
        let publicDHEncJWKString = JSON.stringify(publicDHEncJWK);
        let signature: string = await this.dataService.genSignatureHeader(this.sharedDHMacSecret,
                                                                          "delete /data",
                                                                          this.sessionToken,
                                                                          "text/plain; charset=utf-8",
                                                                          publicDHMacJWKString,
                                                                          publicDHEncJWKString,
                                                                          body);
        // send signed DELETE http request including all parameters and encrypted file
        const response = await this.dataService.dataDelete(
          this.sessionToken,
          publicDHMacJWKString,
          publicDHEncJWKString,
          body,
          signature,
        );
        await this.handleDataResponse(response);
      }
    } else {
      console.log("No active session running. Try Start Session");
    }
  }

  /** Refresh session token using /ping endpoint */
  public async refreshSessionToken(): Promise<void> {
    // stop sessionToken refresh timer
    clearTimeout(this.timer);
    // ensure that a session exists and DH parameters are ready.
    if (this.sharedDHMacSecret && this.sharedDHEncSecret) {
      let body = "";  // GET request has no body
      if (this.mode == "tls") { // tls mode. no need for further calculations
        let signature: string = await this.dataService.genSignatureHeader(this.sharedDHMacSecret,
                                                                          "get /ping",
                                                                          this.sessionToken,
                                                                          "text/plain; charset=utf-8",
                                                                          "",
                                                                          "",
                                                                          body);
        // send signed GET http request including all parameters and current sessionToken
        /*this.pingService.ping(this.sessionToken,
                              "",
                              "",
                              signature).subscribe(async (response: any) => {
                                await this.handlePingResponse(response);
                              });*/
        let response = await this.pingService.ping(this.sessionToken,
          "",
          "",
          signature);
        await this.handlePingResponse(response);
      }
      else {
        // ratchet mode. Need to calculate and include new DH parameters
        let publicDHMacJWK = await crypto.subtle.exportKey("jwk", this.newIterClientDHMac!.publicKey);
        let publicDHEncJWK = await crypto.subtle.exportKey("jwk", this.newIterClientDHEnc!.publicKey);
        let publicDHMacJWKString = JSON.stringify(publicDHMacJWK);
        let publicDHEncJWKString = JSON.stringify(publicDHEncJWK);
        let signature: string = await this.dataService.genSignatureHeader(this.sharedDHMacSecret,
                                                                          "get /ping",
                                                                          this.sessionToken,
                                                                          "text/plain; charset=utf-8",
                                                                          publicDHMacJWKString,
                                                                          publicDHEncJWKString,
                                                                          body);
        // send signed GET http request including all parameters
        /*this.pingService.ping(this.sessionToken,
                              publicDHMacJWKString,
                              publicDHEncJWKString,
                              signature).subscribe(async (response: any) => {
                                await this.handlePingResponse(response);
                              });*/
        let response = await this.pingService.ping(this.sessionToken,
                                                   publicDHMacJWKString,
                                                   publicDHEncJWKString,
                                                   signature);
        await this.handlePingResponse(response);
      }
    }
    else {
      console.log("No active session running. Try Start Session");
    }
  }

  public async handlePingResponse(response: Response): Promise<void> {
    await this.handleDataResponse(response);
  }

  /** 
   * End session, reset all session parameters.
   */
  public endSession(): void {
    // stop sessionToken refresh timer
    clearTimeout(this.timer);
    clearInterval(this.sessionTimer);
    this.endTimer = 0;
    this.sessionTimer = undefined;
    this.sessionTime = null;

    // reset all session relevant values
    this.clientDHMac = undefined;
    this.clientDHEnc = undefined;
    this.newIterClientDHMac = undefined;  // for ratchet mode
    this.newIterClientDHEnc = undefined;

    this.sharedDHMacSecret = undefined;
    this.sharedDHEncSecret = undefined;
    this.newIterSharedDHMacSecret = undefined;  // for ratchet mode
    this.newIterSharedDHEncSecret = undefined;

    this.sessionToken = "";
    this.fileName = "";
    this.exp = 0;
  }

  /**
   * Changes mode (ratchet|tls)
   */
  public changeMode(): void {
    if (this.sessionToken == "") {  // only works if there is currently no active session
      if (this.mode == 'ratchet') {
        this.mode = 'tls';
      }
      else {
        this.mode = 'ratchet';
      }
    }
  }

  /**
   * Do a Performance Test: Request 1000 new session tokens and note how long it took
   */
  public async performanceTestWrapper(): Promise<void> {
    /*let start = Date.now();
    for (let i = 0; i < 1000; i++) {
      await this.refreshSessionToken();
    }
    let end = Date.now();
    document.getElementById("performanceTimer")!.innerHTML = "100 session tokens refreshed in " + (end-start) + " ms";*/

    // Alternative performance test: Refresh Session Tokens for 1 minute and count the number of refreshes
    // Do this 20 times and compute the mean number of refreshes per minute
    let totalNumber = 0;
    let numberPerRound = 0;
    for (let i = 0; i < 20; i++) {
      totalNumber = totalNumber+numberPerRound;
      numberPerRound = 0;
      let done = false;
      // Set timeout which resolves when the time is expired.
      setTimeout(() => {
        done = true;
      }, 60 * 1000);
      while (!done) {
        await this.refreshSessionToken();
        numberPerRound++;
      }
      console.log("Round %d requested %d tokens", i, numberPerRound);
    }
    console.log("Mean %d tokens requested per minute", totalNumber/20);
  }

  /**
   * Show a countdown until the Session Token is refreshed.
   * @param countdown Countdown in seconds.
   */
  private showCountdown(countdown: number): void {
    // Round off the countdown.
    countdown = Math.floor(countdown);

    // Clear the countdown if exists.
    if (this.sessionTimer !== undefined) {
      clearInterval(this.sessionTimer);
    }

    // Update the countdown time every second.
    this.sessionTimer = window.setInterval(() => {
      countdown--;
      if (countdown < 0) {
        this.sessionTime = undefined;
      } else {
        this.sessionTime = countdown;
      }
    }, 1000);
  }
}
