import * as openpgp from 'openpgp';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Identity, IdentityService } from '../../../authentication';
import { Email } from '../../classes/email/email';
import { decodeAndParseMimeMessage, MimeMessage } from '../../classes/mime-message/mime-message';
import { GmailApiService } from '../gmail-api/gmail-api.service';
import { PgpService } from '../pgp/pgp.service';
import { AttachmentFile } from '../../classes/attachment-file/attachment-file';
import { E2ePopPgpOptions } from '../../types/e2e-pop-pgp-options.interface';

import * as jose from 'jose';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  /**
   * Gets a list of identities which are sufficient to send emails via Google Mail.
   */
  public get senderIdentities(): Identity[] {
    return this.identityService.identities.filter(
      id => (id.scopes?.indexOf('https://www.googleapis.com/auth/gmail.send') ?? -1) >= 0 && id.claims.email,
    );
  }

  /**
   * Constructs a new Email Service instance.
   * @param identityService Identity Service instance.
   * @param http HTTP Client instance.
   */
  constructor(
    private readonly identityService: IdentityService,
    private readonly pgpService: PgpService,
    private readonly gmailApiService: GmailApiService,
  ) { }


  /**
   * read i-th messate of the inbox-folder
   * @param mailIndex 
   * @param identity 
   * @returns 
   */
  public async readEmail(mailIndex: number, identity: Identity): Promise<MimeMessage|undefined>{
    let listMailsResult = await this.gmailApiService.listMails(identity);
    if(!listMailsResult){
      return undefined;
    }
    let message = await this.gmailApiService.getMessage(identity, listMailsResult.messages[mailIndex].id);

    if(message?.raw === undefined){
      return undefined;
    }
    
    let emailMessage = decodeAndParseMimeMessage(message.raw);
    return emailMessage;
  }

  /**
   * Sends an email.
   * @param email Email to send.
   */
  public async sendEmail(email: Email, privateKey: openpgp.PrivateKey, passphrase: string, encrypted: boolean): Promise<boolean> {
    let emailString: string | undefined;
    
    if(encrypted){
      let encryptionKeys = this.pgpService.getEncryptionKeys(email.sender, email.receiver);
      if(encryptionKeys!== undefined){
        emailString = await email.toRawEncryptedMimeString(encryptionKeys, privateKey, passphrase);
      }
    }
    else{
      emailString = await email.toRawMimeString(privateKey, passphrase);
    }
    if(emailString !== undefined){
      let res = await this.gmailApiService.sendMail(email.sender, emailString);
      return res !== undefined;
    }
    return false;
  }  

  /**
   * Generates End-to-End Proof-of-Possession Tokens and puts them into one Attachment File.
   * @param keyPair Key Pair whose private key is used to sign the E2E PoP Token and whose public key is used to generate the JWK Thumbprint from.
   * @param pgpOptions Options of the PGP Key.
   * @param icts ICTs to generate a PoP for.
   * @param receiver Email address of the receiver.
   * @returns Attachment File containing the End-to-End Proof-of-Possession Tokens.
   */
   private async generatePoPAttachment(keyPair: CryptoKeyPair, pgpOptions: E2ePopPgpOptions, icts: string[], receiver: string): Promise<AttachmentFile> {
    // Request all End-to-End Proof-of-Possession Tokens.
    const pops = await Promise.all(
      icts.map(async ict => {
        // Get Claims of ICT.
        const decodedIct = jose.decodeJwt(ict);

        // Create creation date.
        const date = Math.floor(Date.now() / 1000);

        // Generate an End-to-End Proof-of-Possession Token.
        return await this.identityService.generateE2ePoP(
          keyPair, {
            iss: 'oidc2-demo',
            aud: receiver,
            sub: decodedIct.sub!,
            jti: this.identityService.generateRandomString(20),
            ict_jti: decodedIct.jti!,
            iat: date,
            nbf: date,
            exp: date + 600,
            pgp_fingerprint: pgpOptions.fingerprint,
          },
        );
      }),
    );

    // Encode all E2E PoP Tokens to one file body.
    const prefix = '-----BEGIN E2E POP TOKEN-----';
    const postfix = '-----END E2E POP TOKEN-----';
    const body = pops.map(
      pop => [
        prefix,
        pop,
        postfix,
      ].join('\r\n\r\n'),
    ).join('\r\n\r\n');

    // Create an Attachment File from the E2E PoP Tokens.
    return new AttachmentFile(
      'E2E_PoP_Tokens.asc',
      window.btoa(body),
      'application/oidc-squared-e2epop',
      'OpenID Connect End-to-End Proof-of-Possession Tokens',
      'base64',
    );
  }

  /**
   * Requests ICTs and puts them into one Attachment File.
   * @param keyPair Key Pair whose private key is used to sign the PoP Token and whose public key is injected into the ID Token.
   * @param identities Identities to request ICTs with.
   * @returns Attachment file containing the ICTs.
   */
   private async generateIctAttachment(keyPair: CryptoKeyPair, identities: Identity[]): Promise<{ file: AttachmentFile, icts: string[]}> {
    // Get ICTs.
    const icts = await Promise.all(
      identities.map(
        id => this.identityService.requestIct(
          id,
          keyPair,
          [
            'name',
            'email',
            'email_verified',
            'given_name',
            'family_name',
            'website',
          ],
        ),
      ),
    );

    // Build ICT File body.
    const prefix = '-----BEGIN IDENTITY CERTIFICATION TOKEN-----';
    const postfix = '-----END IDENTITY CERTIFICATION TOKEN-----'
    const body = icts.map(
      ict => [
        prefix,
        ict,
        postfix
      ].join('\r\n\r\n'),
    ).join('\r\n\r\n');

    // Return ICTs as attachment file.
    return {
      file: new AttachmentFile(
        'Identity_Certification_Tokens.asc',
        window.btoa(body),
        'application/oidc-squared-ict',
        'OpenID Connect Identity Certification Tokens',
        'base64',
      ),
      icts: icts,
    };
  }

  public async generateIctPopAttachments(identities: Identity[], receiver: string, privateKey: openpgp.PrivateKey): Promise<AttachmentFile[]>{
    // Generate new key pair.
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-384',
      },
      false,
      [ 'sign', 'verify' ],
    );

    // Generate ICT attachment file.
    const { file: ictAttachment, icts } = await this.generateIctAttachment(keyPair, identities);
    // Add ICT attachment file to email.

    // Generate E2E PoP Token attachment file.
    const popAttachment = await this.generatePoPAttachment(
      keyPair,
      {
        fingerprint: privateKey.getFingerprint().toUpperCase(),
      },
      icts,
      receiver,
    );

    return [ictAttachment, popAttachment];
  }
}
