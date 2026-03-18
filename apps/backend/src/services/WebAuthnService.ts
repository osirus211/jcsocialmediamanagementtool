import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { IUser } from '../models/User';
import { config } from '../config';

export interface WebAuthnCredential {
  credentialID: string;
  credentialPublicKey: Buffer;
  counter: number;
  transports?: string[];
}

export class WebAuthnService {
  private static readonly rpName = 'Social Media Manager';
  private static readonly rpID = 'localhost';
  private static readonly origin = 'http://localhost:3000';

  static async generateRegistrationOptions(user: IUser) {
    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: Buffer.from(user._id.toString()),
      userName: user.email,
      userDisplayName: `${user.firstName} ${user.lastName}`,
      attestationType: 'none',
      excludeCredentials: user.webauthnCredentials?.map(cred => ({
        id: cred.credentialID,
        type: 'public-key' as const,
        transports: cred.transports as any,
      })) || [],
      authenticatorSelection: {
        residentKey: 'discouraged',
      },
    });

    // Store challenge on user
    user.webauthnChallenge = options.challenge;
    await user.save();

    return options;
  }

  static async verifyRegistration(user: IUser, response: any): Promise<{ verified: boolean }> {
    if (!user.webauthnChallenge) {
      throw new Error('No challenge found for user');
    }

    const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.webauthnChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      // Store credential on user
      if (!user.webauthnCredentials) {
        user.webauthnCredentials = [];
      }

      user.webauthnCredentials.push({
        credentialID: Buffer.from(verification.registrationInfo.credential.id).toString('base64'),
        credentialPublicKey: Buffer.from(verification.registrationInfo.credential.publicKey),
        counter: verification.registrationInfo.credential.counter,
        transports: response.response.transports,
      });

      // Clear challenge
      user.webauthnChallenge = undefined;
      await user.save();
    }

    return { verified: verification.verified };
  }

  static async generateAuthenticationOptions(user: IUser) {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: user.webauthnCredentials?.map(cred => ({
        id: cred.credentialID,
        type: 'public-key' as const,
        transports: cred.transports as any,
      })) || [],
    });

    // Store challenge on user
    user.webauthnChallenge = options.challenge;
    await user.save();

    return options;
  }

  static async verifyAuthentication(user: IUser, response: any): Promise<{ verified: boolean }> {
    if (!user.webauthnChallenge) {
      throw new Error('No challenge found for user');
    }

    const credentialID = Buffer.from(response.id, 'base64url').toString('base64');
    const credential = user.webauthnCredentials?.find(cred => cred.credentialID === credentialID);

    if (!credential) {
      throw new Error('Credential not found');
    }

    const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.webauthnChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: credential.credentialID,
        publicKey: new Uint8Array(credential.credentialPublicKey),
        counter: credential.counter,
        transports: credential.transports as any,
      },
    });

    if (verification.verified) {
      // Update credential counter
      credential.counter = verification.authenticationInfo.newCounter;
      
      // Clear challenge
      user.webauthnChallenge = undefined;
      await user.save();
    }

    return { verified: verification.verified };
  }
}