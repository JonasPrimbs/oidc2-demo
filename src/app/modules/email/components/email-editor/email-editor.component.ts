import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import * as jose from 'jose';
import * as openpgp from 'openpgp';

import { Identity, IdentityService } from '../../../authentication';
import { AttachmentFile } from '../../classes/attachment-file/attachment-file';
import { Email } from '../../classes/email/email';
import { EmailContent } from '../../classes/email-content/email-content';
import { EmailService } from '../../services/email/email.service';
import { PgpService } from '../../services/pgp/pgp.service';
import { E2ePopPgpOptions } from '../../types/e2e-pop-pgp-options.interface';

@Component({
  selector: 'app-email-editor',
  templateUrl: './email-editor.component.html',
  styleUrls: ['./email-editor.component.scss'],
})
export class EmailEditorComponent implements OnInit {
  /**
   * Gets the available sender identities.
   */
  public get senders(): Identity[] {
    return this.emailService.senderIdentities;
  }

  /**
   * Gets all identities whose Identity Provider supports issuing ICTs.
   */
  public get availableIdentities(): Identity[] {
    return this.identityService.identities.filter(
      id => id.identityProvider.supportsIcts,
    );
  }

  /**
   * The available signing keys.
   */
  public availableKeys: { key: openpgp.PrivateKey, passphrase: string, name: string }[] = [];

  /**
   * Gets the available PGP Keys.
   */
  public updateAvailableKeys(): void {
    const identity = this.emailForm.controls.from.value;
    const keys = identity ? this.pgpService.getKeysFor(identity) : [];
    this.availableKeys = keys.map(key => {
      const firstIdentity = key.identities[0];
      return {
        key: key.key,
        passphrase: key.passphrase,
        name: `${firstIdentity?.claims.name} (${firstIdentity.identityProvider.name})`,
      };
    });
  }

  /**
   * The email form.
   */
  public readonly emailForm = new FormGroup({
    from: new FormControl<Identity | null>(null),
    to: new FormControl<string>(''),
    subject: new FormControl<string>(''),
    body: new FormControl<string>(''),
    key: new FormControl<{ key: openpgp.PrivateKey, passphrase: string } | undefined>(undefined),
    identities: new FormControl<Identity[]>([]),
  });

  /**
   * Gets an email instance from the email form.
   */
  private getEmail(): Email | undefined {
    if (!this.emailForm.controls.from.value) {
      return undefined;
    } else {
      return new Email(
        this.emailForm.controls.from.value,
        this.emailForm.controls.to.value ?? '',
        this.emailForm.controls.subject.value ?? '',
        [
          new EmailContent(this.emailForm.controls.body.value ?? ''),
        ]
      );
    }
  }

  /**
   * Gets the selected private key or a random key if no key is selected
   * @returns 
   */
  private async getPrivateKey(): Promise<{key: openpgp.PrivateKey, passphrase: string}>{    
    let privateKey = this.emailForm.controls.key.value ?? await (async () => {
      const passphrase = this.identityService.generateRandomString(20);
      const keyPair = await this.pgpService.generateKeyPair({
        email: this.emailForm.controls.from.value?.claims.email!,
        name: this.emailForm.controls.from.value?.claims.name!,
      }, passphrase);
      return { key: keyPair.privateKey, passphrase };
    })();
    return privateKey;
  }

  /**
   * Constructs a new Email Editor Component.
   * @param emailService Email Service instance.
   * @param pgpService PGP Service instance.
   * @param identityService Identity Service instance.
   */
  constructor(
    private readonly emailService: EmailService,
    private readonly pgpService: PgpService,
    private readonly identityService: IdentityService,
  ) { }

  /**
   * Initializes the component.
   */
  ngOnInit(): void {
    this.pgpService.privateKeysChange.subscribe(() => {
      this.updateAvailableKeys();
    });
    this.emailForm.controls.from.valueChanges.subscribe(() => {
      this.updateAvailableKeys();
    });
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
            pgp: pgpOptions,
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
   * Sends the email.
   */
  public async sendEmail(): Promise<void> {
    const privateKey = await this.getPrivateKey();
    if(!privateKey) return;

    // Get the email instance to send.
    const email = this.getEmail();
    if (!email) return;

    // Generate new key pair.
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-384',
      },
      false,
      [ 'sign', 'verify' ],
    );

    // Get identities.
    const identities = this.emailForm.controls.identities.value;
    if (identities) {
      // Identities were selected.

      // Generate ICT attachment file.
      const { file, icts } = await this.generateIctAttachment(keyPair, identities);
      // Add ICT attachment file to email.
      email.parts.push(file);

      // Generate E2E PoP Token attachment file.
      const pops = await this.generatePoPAttachment(
        keyPair,
        {
          fingerprint: privateKey.key.getFingerprint().toUpperCase(),
        },
        icts,
        email.receiver,
      );
      // Add E2E PoP Token attachment file to email.
      email.parts.push(pops);
    }
    
    // Send the email instance.
    await this.emailService.sendEmail(email, privateKey.key, privateKey.passphrase, true);
  }
}
