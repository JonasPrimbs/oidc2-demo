import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BASE_PATH } from '../../types/variables';

@Injectable({
  providedIn: 'root',
})
export class PingService {
  private readonly defaultHeaders = new HttpHeaders();

  constructor(
    @Inject(BASE_PATH) private readonly basePath: string,
    private readonly httpClient: HttpClient,
  ) { }

  /**
   * Refresh session token
   * GET request to /ping endpoint to fetch a new session token from server
   * @param sessionToken current session token that needs to be replaced before it expires
   * @param publicDHMac new public DH parameter for MAC
   * @param publicDHEnc new public DH parameter for encryption
   * @param signature HTTP message MAC
   */
  public async ping(
    sessionToken: string,
    publicDHMac: string,
    publicDHEnc: string,
    signature: string,
  ): Promise<any> {
    const headers = this.defaultHeaders
      .set('x-e2e-session', sessionToken)
      .set('Content-Type', "text/plain; charset=utf-8")
      .set('x-publicKeyMac', publicDHMac)
      .set('x-publicKeyEnc', publicDHEnc)
      .set('Signature', signature);

    return await firstValueFrom(
      this.httpClient.get(
        this.basePath + '/ping', {
          headers: headers,
          observe: 'response',
          responseType: 'text',
        },
      ),
    );
  }
}
