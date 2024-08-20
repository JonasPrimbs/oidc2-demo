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

  public getIctPopPairs(mimeMessage: MimeMessage): IctPopPair[]{
    // extract icts
    let ictAttachment = mimeMessage.payload.attachments.find(a => a.isIct());
    if(!ictAttachment){
      return [];
    }
    let ictContent =  ictAttachment.decodedText();
    ictContent = ictContent.substring(ictContent.indexOf(this.beginIct) + this.beginIct.length, ictContent.indexOf(this.endIct)).trim();
    let icts = ictContent.split('\r\n');

    // extract pops
    let popAttachment = mimeMessage.payload.attachments.find(a => a.isE2EPoPToken());
    if(!popAttachment){
      return [];
    }
    let popContent = popAttachment?.decodedText();
    popContent = popContent?.substring(popContent.indexOf(this.beginE2EPoPToken) + this.beginE2EPoPToken.length, popContent.indexOf(this.endE2EPoPToken)).trim();
    let pops = popContent?.split('\r\n');

    // create ict/pop pairs
    let ictPops : IctPopPair[] = [];
    for(let i = 0; i < Math.min(icts.length, pops.length); i++){
      ictPops.push({ict: icts[i], pop: pops[i]});
    }

    return ictPops;
  }

  public async verifyOidc2Chain(ictPopPair: IctPopPair, verificationDate?: Date) : Promise<Oidc2VerificationResult> {
    let verificationResult : Oidc2VerificationResult = {
      ictVerified: false,
      popVerified: false,
      pgpKeyId: undefined,
      errorMessage: undefined,
    };

    if(!ictPopPair){
      verificationResult.errorMessage = 'no oidc2 available'
      return verificationResult;
    }

    // decoded ict for accessing issuer and key-id. NOT VERIFIED!
    let decodedIctPayload = await jose.decodeJwt(ictPopPair.ict);
    let decodedIctHeader = await jose.decodeProtectedHeader(ictPopPair.ict);

    // lookup the public JWK of the ICT
    let openIdConfigurationUri = decodedIctPayload.iss + this.openIdConfigurationUriPath;
    let openIdConfiguration = await firstValueFrom(this.http.get<Record<string,any>>(openIdConfigurationUri));

    let jwksUri = openIdConfiguration['jwks_uri'];
    let jwks = await firstValueFrom(this.http.get<Record<string,any[]>>(jwksUri));
    let publicIctJWK = jwks['keys'].find(k => k.kid === decodedIctHeader.kid);

    // public key for ICT verification
    let ictPublicKey = await jose.importJWK(publicIctJWK)

    // verify options
    let verifyIctOptions: ICTVerifyOptions = {}; 
    verifyIctOptions.requiredContext = 'email';
    verifyIctOptions.clockTolerance = 30;
    if(verificationDate){
      verifyIctOptions.currentDate = verificationDate;
    }

    try{
      // todo: sobald bug behoben nachfolgende Zeile zur verification verwenden
      // let ictVerificationResult = await ictVerify(ictPopPair.ict, ictPublicKey, verifyIctOptions);
      let ictVerificationResult = await jose.jwtVerify(ictPopPair.ict, ictPublicKey, verifyIctOptions);

      // no exception: ICT verification successful
      verificationResult.ictVerified = true;
      
      let publicPoPJWK = (ictVerificationResult.payload['cnf'] as any).jwk;
      
      // key have to be extractable (e2ePoPTokenVerify creates a thumbprint of the key)
      let E2EPoPPublicKey = await crypto.subtle.importKey('jwk', publicPoPJWK, { name: "ECDSA", namedCurve: "P-384", }, true, ['verify']);
      // let E2EPoPPublicKey = await jose.importJWK(publicPoPJWK, decodedE2EPoPHeader.alg);        

      // e2ePoPTokenOption
      let verifyE2EPoPTokenOptions: E2EPoPVerifyOptions = { subject: ictVerificationResult.payload.sub ?? ''};
      verifyE2EPoPTokenOptions.clockTolerance = 30;
      if(verificationDate){
        verifyE2EPoPTokenOptions.currentDate = verificationDate;
      }

      let popVerificationResult = await e2ePoPTokenVerify(ictPopPair.pop, E2EPoPPublicKey, verifyE2EPoPTokenOptions);

      // no exception: E2EPoPToken verification successful
      verificationResult.popVerified = true; 

      // todo: pgp-fingerprint muss noch gelesen werden
      verificationResult.pgpKeyId = '';
    }
    catch(err){
      if(err instanceof Error){
        verificationResult.errorMessage = err.message;
      }
    }
    return verificationResult;
  }
}

export interface IctPopPair{
  ict: string,
  pop: string,
}

export interface Oidc2VerificationResult{
  ictVerified: boolean,
  popVerified: boolean,
  pgpKeyId: string | undefined,
  errorMessage: string | undefined,
}
