import { IdentityProvider } from '../identity-provider/identity-provider.class';

export class AuthenticationOptions {
  constructor(
    public readonly identityProviders: IdentityProvider[],
  ) { }
}
