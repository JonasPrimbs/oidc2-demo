/**
 * Endpoint for establishing and maintaining an encrypted client-server session
 * This endpoint establishes an end-to-end encrypted client-server session after authenticating the client with its Id Certification Token (Client_ICT). After the successful exchange of DH parameters, the client can communicate with the server, upload, download or delete files on the server with all communication being encrypted on application layer.
 *
 * OpenAPI spec version: 0.1
 * 
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */

/**
 * A JSON Web Token (JWT) wich MUST   - be signed with an asymmetric algorithm (`ES256`, `ES384`, `ES512`, `RS256`, `RS384`, `RS512`, or `EdDSA` allowed). Example: `\"alg\": \"ES256\"` in the header.   - have the type `\"typ\": \"JWT\"`in the header.   - contain the client's public key in the JWT header (`\"jwk\": <public-key>`).   - contain an encoded valid ICT, signed by OpenID provider's private key (`\"ict\": <client's ict>`).   - contain public DH params used by the client (\"`dh\"`: <client's public DH parameters>`).   - a random stateId (`\"state\": 1`)   - be signed with the client's private key  
 */
export type SessionRequestJwt = string;