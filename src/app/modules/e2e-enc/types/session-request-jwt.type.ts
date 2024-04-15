/**
 * A JSON Web Token (JWT) wich MUST   - be signed with an asymmetric algorithm (`ES256`, `ES384`, `ES512`, `RS256`, `RS384`, `RS512`, or `EdDSA` allowed). Example: `\"alg\": \"ES256\"` in the header.   - have the type `\"typ\": \"JWT\"`in the header.   - contain the client's public key in the JWT header (`\"jwk\": <public-key>`).   - contain an encoded valid ICT, signed by OpenID provider's private key (`\"ict\": <client's ict>`).   - contain public DH params used by the client (\"`dh\"`: <client's public DH parameters>`).   - a random stateId (`\"state\": 1`)   - be signed with the client's private key  
 */
export type SessionRequestJwt = string;
