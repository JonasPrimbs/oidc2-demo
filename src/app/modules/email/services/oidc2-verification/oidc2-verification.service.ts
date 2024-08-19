import { Injectable } from "@angular/core";
import { MimeMessage } from "../../classes/mime-message/mime-message";

import * as jose from 'jose';
import { firstValueFrom } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { e2ePoPTokenVerify, E2EPoPVerifyOptions, ictVerify, ICTVerifyOptions } from "oidc-squared";



@Injectable({
  providedIn: 'root',
})
export class Oidc2VerificationService {

  readonly beginIct = '-----BEGIN IDENTITY CERTIFICATION TOKEN-----';
  readonly endIct = '-----END IDENTITY CERTIFICATION TOKEN-----';

  readonly beginE2EPoPToken = '-----BEGIN E2E POP TOKEN-----';
  readonly endE2EPoPToken = '-----END E2E POP TOKEN-----';

  readonly openIdConfigurationUriPath = '/.well-known/openid-configuration';

  constructor(
    private readonly http: HttpClient,
  ){}

  public async verifyOidc2Chain(mimeMessage: MimeMessage){
    let ictAttachment = mimeMessage.payload.attachments.find(a => a.isIct());
    let ictContent =  ictAttachment?.decodedText();
    ictContent = ictContent?.substring(ictContent.indexOf(this.beginIct) + this.beginIct.length, ictContent.indexOf(this.endIct)).trim();
    let icts = ictContent?.split('\r\n');
    console.log(icts);

    let popAttachment = mimeMessage.payload.attachments.find(a => a.isE2EPoPToken());
    let popContent = popAttachment?.decodedText();
    popContent = popContent?.substring(popContent.indexOf(this.beginE2EPoPToken) + this.beginE2EPoPToken.length, popContent.indexOf(this.endE2EPoPToken)).trim();
    let pops = popContent?.split('\r\n');
    console.log(pops);

    let ictVerificationSuccessful: boolean = false;
    let e2ePoPTokenVerificationSuccessful: boolean = false;

    if(icts !== undefined && pops !== undefined){
      // decoded ict/pop for accessing issuer, key-id and alg. NOT VERIFIED!
      let decodedIctPayload = await jose.decodeJwt(icts[0]);
      let decodedIctHeader = await jose.decodeProtectedHeader(icts[0]);
      let decodedE2EPoPHeader = await jose.decodeProtectedHeader(pops[0]);

      // lookup the public JWK of the ICT
      let openIdConfigurationUri = decodedIctPayload.iss + this.openIdConfigurationUriPath;
      let openIdConfiguration = await firstValueFrom(this.http.get<Record<string,any>>(openIdConfigurationUri));

      let jwksUri = openIdConfiguration['jwks_uri'];
      let jwks = await firstValueFrom(this.http.get<Record<string,any[]>>(jwksUri));
      let publicIctJWK = jwks['keys'].find(k => k.kid === decodedIctHeader.kid);

      // public key for ICT verification
      let ictPublicKey = await jose.importJWK(publicIctJWK)

      // verify options
      let verifyIctOptions: jose.JWTVerifyOptions = {};
      // let verifyIctOptions2: ICTVerifyOptions = {}; // alternative
      // verifyOptions.requiredContext = 'email';
      verifyIctOptions.currentDate = new Date(1724059925000); // todo (mail receiving date)




      try{
        // todo: sobald bug behoben nachfolgende Zeile zur verification verwenden
        // let ictVerificationResult = await ictVerify(icts[0], ictPublicKey, verifyIctOptions);
        let ictVerificationResult = await jose.jwtVerify(icts[0], ictPublicKey, verifyIctOptions);

        // no exception: ICT verification successful
        ictVerificationSuccessful = true;
        
        console.log(ictVerificationResult);

        let publicPoPJWK = (ictVerificationResult.payload['cnf'] as any).jwk;
        // let key = await window.crypto.subtle.importKey('jwk', publicPoPJWK, 'ES384', true, ['verify']);
        // let E2EPoPPublicKey = await jose.importJWK(publicPoPJWK, decodedE2EPoPHeader.alg);

        

        // e2ePoPTokenOption
        // let verifyE2EPoPTokenOptions: E2EPoPVerifyOptions = { subject: ictVerificationResult.payload.sub ?? ''};
        // verifyE2EPoPTokenOptions.currentDate = new Date(1724059925000);
  
        // let popVerificationResult = await e2ePoPTokenVerify(pops[0], key, verifyE2EPoPTokenOptions);

        // no exception: E2EPoPToken verification successful
        // e2ePoPTokenVerificationSuccessful = true; // pgp-fingerprint muss noch übereinstimmen

        // console.log(popVerificationResult);

      }
      catch(e){
        console.log(e);
      }
    }
  }
}
