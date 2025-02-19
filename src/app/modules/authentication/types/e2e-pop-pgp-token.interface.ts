import { E2EPoPTokenPayload, SignE2EPoPToken } from "oidc-squared";

export class SignE2EPoPPGPToken extends SignE2EPoPToken {
  /**
   * The SignE2EPoPToken class is used to build and sign End-to-End Proof-of-Possession Tokens (E2E PoPs) with pgp fingerprint.
   * @param payload Payload of the E2EPoP.
   */
  constructor(payload?: Partial<E2EPoPPGPTokenPayload>){
    super(payload);
  }

  setPgpFingerprint(pgp_fingerprint: string) : this{
    this._payload['pgp_fingerprint'] = pgp_fingerprint;
    return this;
  }
}

interface E2EPoPPGPTokenPayload extends E2EPoPTokenPayload {
  /**
   * PGP-fingerprint.
   */
   pgp_fingerprint: string;
}