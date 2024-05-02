/**
 * A JSON Web Token (JWT) which MUST
 * - be signed with an asymmetric algorithm (`ES256`, `ES384`, `ES512`, `RS256`, `RS384`, `RS512`, or `EdDSA` allowed). Example: (`\"alg\": ES256`).
 * - have the type `\"typ\": \"JWT\"` in the header.
 * - contain the server's public key in the JWT header (`\"jwk\": <public-key>`).
 * - have the server's ICT (that is provided from an RPKI) in `\"ict\": <ICT_Server>`
 * - contain the server's calculated public DH parameters for the client: (`\"dh\": <public DH parameters in jwk format>`)
 * - contain the fitting received stateID from the client in `\"state\"`
 * - carry the DH encrypted sessionID in `\"sid\": enc(DH_secret,<sessionID>)`
 * - be signed with the server's private key
 */
export type SessionResponseJwt = string;
