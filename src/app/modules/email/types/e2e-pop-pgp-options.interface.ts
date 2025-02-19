export interface E2ePopPgpOptions {
  /**
   * Fingerprint of the PGP Key.
   */
  fingerprint: string;

  /**
   * Key Server of the PGP Key.
   * Required, if PGP Key is a long-term key.
   * If not provided, the key is assumed to be ephemeral.
   */
  keyServer?: string;
}
