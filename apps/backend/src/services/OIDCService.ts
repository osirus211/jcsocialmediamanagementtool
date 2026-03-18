import * as openidClient from 'openid-client'

export class OIDCService {
  private config: openidClient.Configuration
  private codeVerifier: string

  static async create(config: {
    issuerUrl: string
    clientId: string
    clientSecret: string
    redirectUri: string
  }): Promise<OIDCService> {
    const issuer = await openidClient.discovery(new URL(config.issuerUrl), config.clientId, config.clientSecret)
    
    const service = new OIDCService()
    service.config = issuer
    service.codeVerifier = openidClient.randomPKCECodeVerifier()
    return service
  }

  async generateAuthorizationUrl(state: string, nonce: string): Promise<string> {
    const codeChallenge = await openidClient.calculatePKCECodeChallenge(this.codeVerifier)
    
    const authUrl = openidClient.buildAuthorizationUrl(this.config, {
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    
    return authUrl.toString()
  }

  async handleCallback(
    callbackUrl: string,
    params: Record<string, string>,
    state: string,
    nonce: string
  ) {
    const tokens = await openidClient.authorizationCodeGrant(
      this.config,
      new URL(callbackUrl),
      {
        pkceCodeVerifier: this.codeVerifier,
        expectedNonce: nonce,
        expectedState: state
      }
    )

    const userinfo = await openidClient.fetchUserInfo(this.config, tokens.access_token, tokens.claims()?.sub)
    return userinfo
  }
}