import { AuthenticationOptions } from './authentication-options.class';

describe('AuthenticationOptions', () => {
  it('should create an instance', () => {
    expect(new AuthenticationOptions([])).toBeTruthy();
  });
});
