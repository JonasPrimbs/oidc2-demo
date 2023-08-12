export class IdentityProvider {
  /**
   * Constructs a new Identity Provider instance.
   * @param name Name.
   * @param baseUrl Issuer URL.
   * @param icon URL to an icon.
   */
  constructor(
    public readonly name: string,
    public readonly baseUrl: string,
    public readonly icon?: string,
  ) { }
}
