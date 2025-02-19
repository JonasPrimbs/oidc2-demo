export class IdentityProvider {
  /**
   * Constructs a new Identity Provider instance.
   * @param name Name.
   * @param baseUrl Issuer URL.
   * @param clientId OAuth 2 Client ID.
   * @param clientSecret OAuth 2 Client Secret.
   * @param icon URL to an icon.
   * @param scopes OAuth 2 scopes.
   * @param supportsIcts Whether ICTs are supported.
   */
  constructor(
    public readonly name: string,
    public readonly baseUrl: string,
    public readonly clientId: string,
    public readonly clientSecret?: string,
    public readonly icon?: string,
    public readonly scopes?: string[],
    public readonly supportsIcts: boolean = false,
  ) { }
}
