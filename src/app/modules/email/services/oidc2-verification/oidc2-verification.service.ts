import { EventEmitter, Injectable } from "@angular/core";
import { MimeMessage } from "../../classes/mime-message/mime-message";

import * as jose from 'jose';
import { firstValueFrom } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { e2ePoPTokenVerify, E2EPoPVerifyOptions, ictVerify, ICTVerifyOptions } from "oidc-squared";
import { Oidc2Identity } from "../../types/oidc2-identity";
import { Oidc2IdentityVerificationResult as Oidc2IdentityVerificationResult } from "../../types/oidc2-identity-verification-result.interface";
import { Identity, IdentityService } from "src/app/modules/authentication";
import { GmailApiService } from "../gmail-api/gmail-api.service";
import { TrustworthyIctIssuer } from "../../types/trustworthy-ict-issuer";



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
    private readonly gmailApiService: GmailApiService,
    private readonly identityService: IdentityService,
  ){
    this.identityService.identitiesChanged.subscribe(() => this.onIdentitiesChanged());
  }

  private async onIdentitiesChanged(){
    let newTrustworthyIssuers: TrustworthyIctIssuer[] = [];
    for(let identity of this.identityService.identities){
      if(identity.hasGoogleIdentityProvider){
        let newIssuers = await this.gmailApiService.loadTrustworthyIctIssuer(identity)
        newTrustworthyIssuers.push(...newIssuers); 
      }
    }
    this._trustworthyIssuers = [...newTrustworthyIssuers];
    this.trustworthyIssuersChanged.emit();
  }

  /**
   * Internal represenatation of all trustful issuers.
   */
   private _trustworthyIssuers: TrustworthyIctIssuer[] = [];

   public readonly trustworthyIssuersChanged = new EventEmitter<void>();


    public get trustworthyIssuers(){
      return [...this._trustworthyIssuers];
    }

  private async getTrustworthyIssuers(identity: Identity): Promise<TrustworthyIctIssuer[]>{
    return this.gmailApiService.loadTrustworthyIctIssuer(identity);
  }

  public async trustIssuer(identity: Identity, issuer: string){
    let message = await this.gmailApiService.saveTrustworthyIctIssuer(identity, issuer);
    if(message){
      this._trustworthyIssuers.push({identity, issuer, messageId: message?.id});
      this.trustworthyIssuersChanged.emit();
    }
  }

  public async untrustIssuer(untrustedIssuer: TrustworthyIctIssuer){
    let filtered = this._trustworthyIssuers.filter(t => t !== untrustedIssuer);
    await this.gmailApiService.deleteMesage(untrustedIssuer.identity, untrustedIssuer.messageId);
    if(filtered !== this._trustworthyIssuers){
      this._trustworthyIssuers = filtered;
      this.trustworthyIssuersChanged.emit();
    }
  }


  /**
   * Extract the ICT/PoP-pairs of a MimeMessage
   * @param mimeMessage 
   * @returns 
   */
  public getIctPopPairs(mimeMessage: MimeMessage): {ict: string, pop: string} []{
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
    let ictPops : {ict: string, pop: string} [] = [];
    for(let i = 0; i < Math.min(icts.length, pops.length); i++){
      ictPops.push({ict: icts[i], pop: pops[i]});
    }

    return ictPops;
  }

  /**
   * Verify the OIDC² Identity of a ICT/PoP-pair
   * @param ictPopPair 
   * @param verificationDate 
   * @returns 
   */
  public async verifyOidc2Identity(ictPopPair: {ict: string, pop: string}, verifierIdentity: Identity, verificationDate?: Date) : Promise<Oidc2IdentityVerificationResult> {
    let ictVerified: boolean = false;
    let popVerified: boolean = false;
    let errorMessage: string | undefined;
    let oidc2identity: Oidc2Identity | undefined;

    if(!ictPopPair){
      let result: Oidc2IdentityVerificationResult = {
        ictVerified: false,
        popVerified: false,
        errorMessage: 'no OIDC² available',
      }
      
      return result;
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

      let trustworthyIctIssuer = await (await this.getTrustworthyIssuers(verifierIdentity)).map(t => t.issuer);

      // is ICT issuer trustworthy?
      if(ictVerificationResult.payload.iss && trustworthyIctIssuer.includes(ictVerificationResult.payload.iss)){
        ictVerified = true;
      }
      else{
        errorMessage = `ICT issuer ${ictVerificationResult.payload.iss} is not trustworthy`;
      }
      
      let publicPoPJWK = (ictVerificationResult.payload['cnf'] as any).jwk;     

      // key have to be extractable (e2ePoPTokenVerify creates a thumbprint of the key)
      let E2EPoPPublicKey = await crypto.subtle.importKey('jwk', publicPoPJWK, { name: "ECDSA", namedCurve: "P-384", }, true, ['verify']);

      // e2ePoPTokenOption
      let verifyE2EPoPTokenOptions: E2EPoPVerifyOptions = { subject: ictVerificationResult.payload.sub ?? ''};
      verifyE2EPoPTokenOptions.requiredClaims = ['pgp_fingerprint']
      verifyE2EPoPTokenOptions.clockTolerance = 30;
      if(verificationDate){
        verifyE2EPoPTokenOptions.currentDate = verificationDate;
      }

      let popVerificationResult = await e2ePoPTokenVerify(ictPopPair.pop, E2EPoPPublicKey, verifyE2EPoPTokenOptions);

      // no exception: E2EPoPToken verification successful
      popVerified = true; 

      // create oidc2-identity
      oidc2identity = {
        email: ictVerificationResult.payload['email'] as string,
        email_verified: ictVerificationResult.payload['email_verified'] as boolean,
        issuer: ictVerificationResult.payload.iss ?? '',
        preferred_username: ictVerificationResult.payload['preferred_username'] as string,
        pgpFingerprint: popVerificationResult.payload['pgp_fingerprint'] as string,
      }
    }
    catch(err){
      if(err instanceof Error){
        errorMessage = err.message;
      }
    }

    let oidc2verificationResult : Oidc2IdentityVerificationResult = {
      ictVerified,
      popVerified,
      identity: oidc2identity,
      errorMessage,
    }

    return oidc2verificationResult;
  }
}
