# OIDC-Squared

The OIDC² library for Browsers.


## Install

```bash
npm install oidc-squared
```


## Documentation

The following shows a quick introduction to the OIDC² library.
A more-detailed documentation is provided [here](https://jonasprimbs.github.io/oidc-squared/).


### Supported Signing Algorithms

| Algorithm | Supported |
|-----------|-----------|
| `ES256`   | ✅         |
| `ES384`   | ✅         |
| `ES512`   | ✅         |
| `RS256`   | ✅         |
| `RS384`   | ✅         |
| `RS512`   | ✅         |
| `PS256`   | ✅         |
| `PS384`   | ✅         |
| `PS512`   | ✅         |
| `EdDSA`   | ❌         |


## Coding Examples

### Generate Client Key Pair

Use Web Crypto API to generate an asymmetric key pair:

```typescript
const clientKeyPair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-384' },
  false,
  ['sign', 'verify'],
);
```

For more examples see [key pair generation examples](./examples/key-pair-generation.md).


### Proof-of-Possession Token

#### PoP Token Generation

A PoP Token is typically generated on the Client using the following code:

```typescript
import { NonceGenerators, SignPoPToken } from 'oidc-squared';

// Export the JWK public key:
const publicJwk = await crypto.subtle.exportKey('jwk', clientKeyPair.publicKey);

// Create a new PoP Token:
const popToken = await new SignPoPToken() // Also sets "iat" to now, "exp" to in 60 seconds, and "jti" to a new UUID.
  .setPublicKey('ES384', publicJwk)       // Sets the public key and its algorithm.
  .setIssuer('myclient')                  // Sets Issuer (= Client ID).
  .setSubject('alice')                    // Sets Subject (= End-User's Subject ID).
  .setAudience('https://op.example.com')  // Sets Audience (= OpenID Provider's Issuer URL).
  .setRequiredClaims(['name'])            // (Optional) Sets the requested required claims for the ICT.
  .setOptionalClaims(['email'])           // (Optional) Sets the requested optional claims for the ICT.
  .setWithAudience(true)                  // Sets whether the audience claim should be present in the ICT.
  .sign(clientKeyPair.privateKey);        // Signs the PoP Token asynchronously and returns its token string.
```

For more detailled examples, see [PoP Token Generation examples](./examples/pop-token-generation.md).


#### PoP Token Verification

A PoP Token is typically generated on the OpenID Provider using the following code:

```typescript
import { popTokenVerify } from 'oidc-squared';

try {
  // Verify and parse the PoP Token:
  const popResult = await popTokenVerify(
    popToken,               // The PoP Token to parse and verify.
    {
      issuer: clientId,     // Set expected Issuer (= Client ID) or leave empty to accept all (NOT RECOMMENDED!).
      subject: subject,     // Set expected Subject (= End-User's Subject ID) or leave empty to accept all (NOT RECOMMENDED!).
      audience: opBaseUrl,  // (REQUIRED) Set expected Audience (= OpenID Provider's Issuer URL).
      maxTokenAge: 300,     // Maximum accepted age of the PoP Token in seconds. 300 seconds (= 5 minutes) is the maximum recommended value.
    },
  );

  // Extract the parsed header and payload from the PoP Token:
  const popHeader = popResult.protectedHeader;
  const popPayload = popResult.payload;
} catch (e) {
  // Error will be thrown if token verification fails.
}
```


### Identity Certification Token

#### ICT Request

An ICT is typically requested by the Client from the OpenID Provider using the following code:

```typescript
import { getIctEndpoint, requestIct } from 'oidc-squared';

// If not yet known, you can request the ICT Endpoint from the Discovery Document:
const ictEndpoint = await getIctEndpoint('https://op.example.com');

// Request ICT from ICT Endpoint:
const ictResponse = await requestIct({
  ictEndPoint: ictEndpoint,   // Provide ICT Endpoint here.
  accessToken: 'ey...',       // Insert Access Token for authorization here.
  popToken: popToken,         // Insert previously generated PoP Token here.
  requiredClaims: ['name'],   // Insert all REQUIRED identity claims you want to be provided in the ICT here.
  optionalClaims: ['email'],  // Insert all OPTIONAL identity claims you want to be provided in the ICT here.
});

// The ICT can be found in the identity_certification_token parameter of the response.
const ict = ictResponse.identity_certification_token;
```


#### ICT Generation

An ICT is typically generated on the OpenID Provider using the following code:

```typescript
import { SignICT } from 'oidc-squared';

// Create a new ICT:
const ict = await new SignICT()         // Also sets "iat" to now, "exp" to in 300 seconds, and "jti" to a new UUID.
  .setKeyId('RS384', 'key#1')           // Sets the Key ID and its algorithm.
  .setIssuer('https://op.example.com')  // Sets Issuer (= OpenID Provider's Issuer URL).
  .setSubject('alice')                  // Sets Subject (= End-User's Subject ID).
  .setAudience('myclient')              // (OPTIONAL) Sets Audience (= Client ID).
  .setConfirmation(popResult.protectedHeader.jwk) // Sets Confirmation (= Client's Public Key).
  .setContext(['app-1', 'app-2'])       // Set the granted e2e authentication contexts.
  .sign(opKeyPair.privateKey);          // Signs the ICT asynchronously and returns its token string.
```

For more detailled examples, see [ICT Generation examples](./examples/ict-generation.md).


#### ICT Verification

An ICT is typically verified on the Authenticating Party using the following code:

```typescript
import { ictVerify } from 'oidc-squared';

try {
  // Verify and parse the ICT:
  const ictResult = await ictVerify(
    ict,                                // The ICT to parse and verify.
    opKeyPair.publicKey,                // Public Key of the OpenID Provider to verify the signature with.
    {
      issuer: 'https://op.example.com', // Set expected Issuer (= OpenID Provider's Issuer URL) or leave empty to accept all (NOT RECOMMENDED!).
      subject: 'alice',                 // Set expected Subject (= End-User's Subject ID) or leave empty to accept all (NOT RECOMMENDED!).
      audience: 'myclient',             // (OPTIONAL) Set expected Audience (= Client ID of Client) or leave empty to accept all.
      maxTokenAge: 3600,                // Maximum accepted age of the PoP Token in seconds. 3600 seconds (= 1 hour) is the maximum recommended value.
      requiredContext: ['app-1'],       // Required e2e authentication contexts.
    },
  );

  // Extract the parsed header and payload from the ICT:
  const ictHeader = ictResult.protectedHeader;
  const ictPayload = ictResult.payload;
} catch (e) {
  // Error will be thrown if token verification fails.
}
```


### End-to-End Proof-of-Possession Token

#### E2E PoP Token Generation

An E2E PoP Token is typically generated by the Client using the following code:

```typescript
import * as jose from 'jose';
import { SignE2EPoPToken } from 'oidc-squared';

// Calculate the JWK Thumbprint from the Client's public key.
const jkt = await jose.calculateJwkThumbprint(
  await jose.exportJWK(clientKeyPair.publicKey),
  'sha256',
);

// Create a new E2E PoP Token:
const e2ePoPToken = await new SignE2EPoPToken() // Also sets "iat" to now, "exp" to in 300 seconds, and "jti" to a new UUID.
  .setThumbprint('ES384', jkt)                  // Sets the JWK Thumbprint and its algorithm.
  .setIssuer('myclient')                        // Sets Issuer (= Client's Client ID).
  .setSubject(subject)                          // Sets Subject (= End-User's Subject ID).
  .setAudience('sessionid')                     // Sets Audience (= Session ID, User ID, or Client ID that the Authenticating Party uniquely identifies with).
  .sign(clientKeyPair.privateKey);              // Signs the ICT asynchronously and returns its token string.
```

For more detailled examples, see [E2E PoP Generation examples](./examples/e2e-pop-token-generation.md).


#### E2E PoP Token Verification

An E2E PoP Token is typically verified by the Authenticating Party using the following code:

```typescript
import * as jose from 'jose';
import { e2ePoPTokenVerify } from 'oidc-squared';

// Import the public key from the ICT's confirmation claim:
const clientPublicKey = await jose.importJWK(ictPayload.cnf.jwk);

try {
  // Verify and parse the E2E PoP Token:
  const e2ePoPResult = await e2ePoPTokenVerify(
    e2ePoPToken,                      // The E2E PoP Token to parse and verify.
    clientPublicKey,                  // Imported Public Key of the public key.
    {
      issuer: ictResult.payload.aud,  // Set expected Issuer (= Client ID of Client) or leave empty to accept all. If the audience claim in the ICT is provided, it MUST match it!
      subject: ictResult.payload.sub, // Set expected Subject (= End-User's Subject ID). It MUST match the subject claim from the ICT!
      audience: 'sessionid',          // Set expected audience.
      maxTokenAge: 3600,              // Maximum accepted age of the E2E PoP Token in seconds. 3600 seconds (= 1 hour) is the maximum recommended value.
    }
  );

  // Extract the parsed header and payload from the E2E PoP Token:
  const e2ePoPHeader = e2ePoPResult.protectedHeader;
  const e2ePoPPayload = e2ePoPResult.payload;
} catch (e) {
  // Error will be thrown if token verification fails.
}
```
