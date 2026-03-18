import { SAML } from '@node-saml/node-saml'
import * as crypto from 'crypto'

export interface SAMLConfig {
  entryPoint: string      // IdP SSO URL
  issuer: string          // Our SP entity ID
  cert: string            // IdP certificate
  callbackUrl: string     // Our ACS URL
  wantAuthnResponseSigned?: boolean
}

export interface SAMLProfile {
  nameID: string
  nameIDFormat: string
  email?: string
  firstName?: string
  lastName?: string
  groups?: string[]
}

export class SAMLService {
  private saml: SAML

  constructor(private config: SAMLConfig) {
    this.saml = new SAML({
      entryPoint: config.entryPoint,
      issuer: config.issuer,
      cert: config.cert,
      callbackUrl: config.callbackUrl,
      wantAuthnResponseSigned: config.wantAuthnResponseSigned ?? true,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
    } as any)
  }

  async generateAuthorizeUrl(relayState?: string): Promise<string> {
    return this.saml.getAuthorizeUrlAsync(
      relayState || '',
      undefined,
      {}
    )
  }

  async validateResponse(
    samlResponse: string,
    relayState?: string
  ): Promise<SAMLProfile> {
    const { profile } = await this.saml.validatePostResponseAsync({
      SAMLResponse: samlResponse,
      RelayState: relayState,
    })

    if (!profile) {
      throw new Error('Invalid SAML response')
    }

    return {
      nameID: profile.nameID,
      nameIDFormat: profile.nameIDFormat || '',
      email: profile.email as string || profile.nameID,
      firstName: profile.firstName as string,
      lastName: profile.lastName as string,
      groups: profile.groups as string[],
    }
  }

  async generateMetadataXml(): Promise<string> {
    return this.saml.generateServiceProviderMetadata(null, null)
  }
}