import * as jose from 'jose';
import * as openpgp from 'openpgp';

import { MimeMessage } from "../../classes/mime-message/mime-message";
import { EventEmitter, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { e2ePoPTokenVerify, E2EPoPVerifyOptions, ictVerify, ICTVerifyOptions } from "oidc-squared";
import { Oidc2Identity } from "../../types/oidc2-identity";
import { Oidc2IdentityVerificationResult as Oidc2IdentityVerificationResult } from "../../types/oidc2-identity-verification-result.interface";
import { Identity } from "src/app/modules/authentication";
import { TrustworthyIctIssuer } from "../../types/trustworthy-ict-issuer";
import { PgpService } from "../pgp/pgp.service";
import { DecryptedAndVerifiedMimeMessage, MimeMessageSecurityResult } from "../../types/mime-message-security-result.interface";
import { SignatureVerificationResult } from "../../types/signature-verification-result.interface";
import { EmailService } from '../email/email.service';

@Injectable({
  providedIn: 'root',
})
export class PgpKeyAuthenticationService {

  readonly beginIct = '-----BEGIN IDENTITY CERTIFICATION TOKEN-----';
  readonly endIct = '-----END IDENTITY CERTIFICATION TOKEN-----';

  readonly beginE2EPoPToken = '-----BEGIN E2E POP TOKEN-----';
  readonly endE2EPoPToken = '-----END E2E POP TOKEN-----';

  readonly openIdConfigurationUriPath = '/.well-known/openid-configuration';

  readonly trustworthyRootIctIssuerKey = "TRUSTWORTHY_ROOT_ICT_ISSUER";

  constructor(
    private readonly http: HttpClient,
    private readonly pgpService: PgpService,
    private readonly emailService: EmailService,
  ){
    let issuers = localStorage.getItem(this.trustworthyRootIctIssuerKey);
    if(issuers){
      let parsedIssuers = JSON.parse(issuers) as string[];
      this._trustworthyRootIssuers = parsedIssuers;
    }
  }

  /**
   * Internal represenatation of all trustful issuers.
   */
   private _trustworthyIssuers: TrustworthyIctIssuer[] = [];

  /**
   * The trustworthy Issuers changed 
   * */ 
  public readonly trustworthyIssuersChanged = new EventEmitter<void>();

  /**
   * the trustworthy ICT issuers
   */
  public get trustworthyIssuers(){
    return [...this._trustworthyIssuers];
  }

  /**
   * Internal representation of the trustworthy root issuers
   */
  private _trustworthyRootIssuers: string[] = [];

  /**
   * the trustworthy root ICT issuers
   */
   public get trustworthyRootIssuers(){
    return [...this._trustworthyRootIssuers];
  }

  /**
   * Get the trustworthy ICT-Issuers of a identity
   * @param identity 
   * @returns 
   */
  public async getTrustworthyIssuers(identity: Identity): Promise<TrustworthyIctIssuer[]>{
    return this.trustworthyIssuers.filter(t => t.identity === identity);
  }

  /**
   * trust ict issuers
   * @param identity 
   * @param issuer 
   * @returns 
   */
  public trustIssuer(identity: Identity, issuer: string, messageId: string):  TrustworthyIctIssuer{
    let trustworthyIctIssuer = {identity, issuer, messageId};
    this._trustworthyIssuers.push(trustworthyIctIssuer);
    this.trustworthyIssuersChanged.emit();
    return trustworthyIctIssuer;
  }

  /**
   * untrust an ICT issuer
   * @param untrustedIssuer 
   */
  public async untrustIssuer(untrustedIssuer: TrustworthyIctIssuer){
    let filtered = this._trustworthyIssuers.filter(t => t !== untrustedIssuer);
    if(filtered !== this._trustworthyIssuers){
      this._trustworthyIssuers = filtered;
      this.trustworthyIssuersChanged.emit();
    }
  }

  /**
   * set the trustworthy ict issuers
   * @param trustworthyIctIssuers 
   */
  public setTrustworthyIctIssuers(trustworthyIctIssuers: TrustworthyIctIssuer[]){
    this._trustworthyIssuers = [...trustworthyIctIssuers];
    this.trustworthyIssuersChanged.emit();
  }

  /**
   * add a new root ICT issuer
   * @param issuer 
   */
  public addRootIctIssuer(issuer: string){
    this._trustworthyRootIssuers.push(issuer);
    localStorage.setItem(this.trustworthyRootIctIssuerKey, JSON.stringify(this._trustworthyRootIssuers));
  }

  /**
   * checks the security of a mime message.
   * decrypts the message if encrypted.
   * verifies signatures and oidc2identity
   * authenticates the PGP key
   * @param mimeMessage 
   * @returns 
   */
   public async authenticatePgpKey(mimeMessage: MimeMessage, verifierIdentity: Identity, additionalTrustworthyIctIssuers?: string[]) : Promise<MimeMessageSecurityResult>{
    
    // decrypt and verify the PGP signature
    let decryptedMimeMessage = await this.emailService.decryptAndVerifyMimeMessage(mimeMessage);
    
    // find the ICT-PoP pairs
    let ictPopPairs = this.getIctPopPairs(decryptedMimeMessage.clearetextMimeMessage);

    // verify OIDC²-identity
    let oidc2VerificationResults = await this.verifyOidc2Identity(ictPopPairs, verifierIdentity, mimeMessage.payload.date, additionalTrustworthyIctIssuers);
    
    // authenticate the PGP key
    let verifiedSignatures = await this.authenticatePgpKeyAndVerifySignatures(decryptedMimeMessage, oidc2VerificationResults);
        
    let result: MimeMessageSecurityResult = {
      encrypted: decryptedMimeMessage.encrypted,
      decryptionSuccessful: decryptedMimeMessage.decryptionSuccessful,
      decryptionErrorMessage: decryptedMimeMessage.decryptionErrorMessage,
      oidc2VerificationResults,
      signatureVerificationResults: verifiedSignatures,
      clearetextMimeMessage: decryptedMimeMessage.clearetextMimeMessage,
      publicKey: decryptedMimeMessage.publicKey,
    };

    return result;
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
    let icts = this.getTokens(ictContent, this.beginIct, this.endIct);

    // extract pops
    let popAttachment = mimeMessage.payload.attachments.find(a => a.isE2EPoPToken());
    if(!popAttachment){
      return [];
    }
    let popContent = popAttachment?.decodedText();
    let pops = this.getTokens(popContent, this.beginE2EPoPToken, this.endE2EPoPToken);

    // create ict/pop pairs
    let ictPops : {ict: string, pop: string} [] = [];
    for(let i = 0; i < Math.min(icts.length, pops.length); i++){
      ictPops.push({ict: icts[i], pop: pops[i]});
    }

    return ictPops;
  }

  /**
   * extracts ict/pop tokens out of a file
   * @param tokenFileContent 
   * @param start 
   * @param end 
   * @returns 
   */
  private getTokens(tokenFileContent: string, start: string, end: string): string[]{
    let tokens: string[] = [];
    while(tokenFileContent.includes(start) && tokenFileContent.includes(end)){
      let startindex = tokenFileContent.indexOf(start) + start.length;
      let endindex = tokenFileContent.indexOf(end);
      tokens.push(tokenFileContent.substring(startindex, endindex).trim());
      tokenFileContent = tokenFileContent.substring(endindex + end.length);
    }
    return tokens;
  }

  /**
   * Verify the OIDC² Identity of a ICT/PoP-pair
   * @param ictPopPair 
   * @param verificationDate 
   * @returns 
   */
  private async verifyOidc2Identity(ictPopPairs: {ict: string, pop: string}[], verifierIdentity: Identity, verificationDate?: Date, additionalTrustworthyIssuers?: string[]) : Promise<Oidc2IdentityVerificationResult[]> {
    let ictVerified: boolean = false;
    let popVerified: boolean = false;
    let errorMessage: string | undefined;
    let oidc2identity: Oidc2Identity | undefined;

    if(ictPopPairs.length === 0){
      let result: Oidc2IdentityVerificationResult = {
        ictVerified: false,
        popVerified: false,
        errorMessage: 'no OIDC² available',
      }
      
      return [ result ];
    }

    let oidc2verificationResults: Oidc2IdentityVerificationResult[] = [];

    for(let ictPopPair of ictPopPairs){ 
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
        let ictVerificationResult = await ictVerify(ictPopPair.ict, ictPublicKey, verifyIctOptions);

        let trustworthyIctIssuer = (await this.getTrustworthyIssuers(verifierIdentity)).map(t => t.issuer);
        
        if(additionalTrustworthyIssuers){
          trustworthyIctIssuer = [...trustworthyIctIssuer, ...additionalTrustworthyIssuers];
        }

        // is ICT issuer trustworthy?
        if(ictVerificationResult.payload.iss && trustworthyIctIssuer.includes(ictVerificationResult.payload.iss)){
          ictVerified = true;
        }
        else{
          errorMessage = `ICT issuer ${ictVerificationResult.payload.iss} is not trustworthy`;
        }
              
        let publicPoPJWK = ictVerificationResult.payload.cnf.jwk;     

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

        let ictJwtIoUrl = `https://jwt.io/#debugger-io?token=${ictPopPair.ict}`;
        let uriEncodedPopPublicKey = encodeURIComponent(JSON.stringify(publicPoPJWK));
        let popJwtIoUrl = `https://jwt.io/#debugger-io?token=${ictPopPair.pop}&publicKey=${uriEncodedPopPublicKey}`;

        // create oidc2-identity
        oidc2identity = {
          email: ictVerificationResult.payload['email'] as string,
          emailVerified: ictVerificationResult.payload['email_verified'] as boolean,
          issuer: ictVerificationResult.payload.iss ?? '',
          preferred_username: ictVerificationResult.payload['preferred_username'] as string,
          pgpFingerprint: popVerificationResult.payload['pgp_fingerprint'] as string,
          ictJwtIoUrl: ictJwtIoUrl,
          ict: ictPopPair.ict,
          popJwtIoUrl: popJwtIoUrl,
          pop: ictPopPair.pop,
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

      oidc2verificationResults.push(oidc2verificationResult);
    }

    return oidc2verificationResults;
  }

    /**
   * validates openpgp signature verification results against oidc2 identity verification results
   * @param signatures 
   * @param oidc2VerificationResults 
   * @param publicKey 
   * @returns 
   */
    private async authenticatePgpKeyAndVerifySignatures(decryped: DecryptedAndVerifiedMimeMessage, oidc2VerificationResults: Oidc2IdentityVerificationResult[]): Promise<SignatureVerificationResult[]>{  
    let signatureVerificationResults: SignatureVerificationResult[] = [];

    // no public key available
    if(!decryped.publicKey){
      signatureVerificationResults.push({
        pgpKeyAuthenticated: false,
        signatureVerified: false,
      });

      return signatureVerificationResults;
    }

    let publicKey : openpgp.PublicKey = decryped.publicKey!;
    let publicKeyFingerprint = publicKey.getFingerprint(); 
    let publicKeyOnKeyServer = await this.pgpService.searchPublicKeyOnKeyServer(publicKey.getFingerprint());


    for(let result of decryped.signatures){
      let signatureKeyId = this.pgpService.getPrettyKeyID(result.keyID); 

      try{
        await result.verified;
        let signature = await result.signature;
        
        // find oidc2 result with matching pgp-fingerprint
        let matchingOidc2Result = oidc2VerificationResults.find(r => r.ictVerified && r.popVerified && r.identity && r.identity.pgpFingerprint && r.identity.pgpFingerprint.toLowerCase() === publicKeyFingerprint.toLowerCase());

        let pgpKeyAuthenticated = matchingOidc2Result !== undefined;

        // check revocation
        if(publicKeyOnKeyServer && await publicKeyOnKeyServer.isRevoked()){
          signatureVerificationResults.push({
            pgpKeyAuthenticated,
            signatureVerified: false,
            signatureErrorMessage: 'public key is revoked',
            oidc2Identity: undefined,
            keyId: signatureKeyId,
            signedAt: undefined
          });          
        }
        else if(matchingOidc2Result){
          // signature verification successful and oidc2 chain verification successful
          signatureVerificationResults.push({
            pgpKeyAuthenticated,
            signatureVerified: true,
            oidc2Identity: matchingOidc2Result.identity,
            keyId: signatureKeyId,
            signedAt: signature.packets[0].created ?? undefined
          });
        }
        else{
          let errorMessage = '';
          if(oidc2VerificationResults.length === 0){
            errorMessage = 'no OIDC² identity available';
          }
          else{
            errorMessage = `no matching OIDC² identity for PGP-fingerprint ${publicKeyFingerprint.toUpperCase()} found. Key is unauthenticated`;
          }
          
          signatureVerificationResults.push({
            pgpKeyAuthenticated,
            signatureVerified: true,
            oidc2ErrorMessage: errorMessage,
            keyId: signatureKeyId,
          });
        }              
      }
      catch(ex){
        // signature verification failed
        let errorMessage = 'invalid signature';
        if(ex instanceof Error){
          errorMessage = ex.message;
        }
        signatureVerificationResults.push({
          pgpKeyAuthenticated: false,
          signatureVerified: false,
          signatureErrorMessage: errorMessage,
        });
      }
    }

    // mail is neither encrypted nor signed
    if(signatureVerificationResults.length === 0){
      let noSignatureResult: SignatureVerificationResult = {
        pgpKeyAuthenticated: false,
        signatureVerified: false,
        signatureErrorMessage: 'no signature available',
      };
      signatureVerificationResults.push(noSignatureResult);
    }

    return signatureVerificationResults;
  }

}
