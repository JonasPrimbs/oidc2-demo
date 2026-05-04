import { E2ePopClaims } from "./e2e-pop-claims.interface";

export interface E2ePopPgpClaims extends E2ePopClaims{
  /**
   * the pgp-fingerprint of a corresponding pgp-key
   */
  pgp_fingerprint?: string,
}