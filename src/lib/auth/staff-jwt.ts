import { JwtPayload, sign, verify } from 'jsonwebtoken';

const SECRET = process.env.CLIENT_SECRET || '';

export interface StaffPayload extends JwtPayload {
  type: 'staff';
  merchantId: string;
  authorizedAppId: string;
  role: string;
  permissions: string[];
  email: string;
  name: string;
}

export function createStaffToken(payload: Omit<StaffPayload, 'type' | 'iat' | 'exp'>): string {
  return sign({ type: 'staff', ...payload }, SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
}

export function verifyStaffToken(token: string): StaffPayload | null {
  try {
    const data = verify(token, SECRET) as StaffPayload;
    if (data.type !== 'staff') return null;
    return data;
  } catch {
    return null;
  }
}
