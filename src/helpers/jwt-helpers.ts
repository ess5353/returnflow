import { JwtPayload, sign, verify } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export class JwtHelpers {
  static verifyToken(token: string): JwtPayload | undefined {
    const secret = process.env.CLIENT_SECRET;
    // Fail-closed: never verify with an empty secret
    if (!secret) return undefined;
    try {
      const decoded = verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
      // Reject staff tokens presented in the owner JWT scheme (type confusion attack)
      if ((decoded as Record<string, unknown>).type === 'staff') return undefined;
      return decoded;
    } catch {
      return undefined;
    }
  }

  static createToken(merchantId: string, authorizedAppId: string) {
    const secret = process.env.CLIENT_SECRET;
    if (!secret) throw new Error('CLIENT_SECRET is not configured');
    return sign({}, secret, {
      expiresIn: '4h',
      algorithm: 'HS256',
      subject: merchantId,
      issuer: process.env.NEXT_PUBLIC_DEPLOY_URL || '',
      audience: authorizedAppId,
      jwtid: uuidv4(),
    });
  }
}
