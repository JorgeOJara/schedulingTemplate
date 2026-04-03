import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import env from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET as Secret;

export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  INVITE: 'invite',
  PASSWORD_RESET: 'password_reset',
} as const;

export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

export interface AccessTokenPayload {
  tokenType: typeof TOKEN_TYPES.ACCESS;
  userId: string;
  orgId: string;
  role: string;
}

export interface RefreshTokenPayload {
  tokenType: typeof TOKEN_TYPES.REFRESH;
  userId: string;
}

export interface InviteTokenPayload {
  tokenType: typeof TOKEN_TYPES.INVITE;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  orgId: string;
}

export interface PasswordResetTokenPayload {
  tokenType: typeof TOKEN_TYPES.PASSWORD_RESET;
  userId: string;
}

const signToken = (payload: object, expiresIn: string): string => {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, JWT_SECRET, options);
};

const verifyTypedToken = <TPayload extends { tokenType: TokenType }>(
  token: string,
  expectedTokenType: TokenType
): TPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || typeof decoded !== 'object') {
      return null;
    }

    const payload = decoded as TPayload;
    return payload.tokenType === expectedTokenType ? payload : null;
  } catch {
    return null;
  }
};

export const signAccessToken = (userId: string, orgId: string, role: string): string => {
  return signToken(
    {
      tokenType: TOKEN_TYPES.ACCESS,
      userId,
      orgId,
      role,
    } satisfies AccessTokenPayload,
    env.JWT_EXPIRY
  );
};

export const signRefreshToken = (userId: string): string => {
  return signToken(
    {
      tokenType: TOKEN_TYPES.REFRESH,
      userId,
    } satisfies RefreshTokenPayload,
    env.REFRESH_TOKEN_EXPIRY
  );
};

export const signInviteToken = (payload: Omit<InviteTokenPayload, 'tokenType'>): string => {
  return signToken(
    {
      tokenType: TOKEN_TYPES.INVITE,
      ...payload,
    } satisfies InviteTokenPayload,
    '7d'
  );
};

export const signPasswordResetToken = (userId: string): string => {
  return signToken(
    {
      tokenType: TOKEN_TYPES.PASSWORD_RESET,
      userId,
    } satisfies PasswordResetTokenPayload,
    '1h'
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
  return verifyTypedToken<AccessTokenPayload>(token, TOKEN_TYPES.ACCESS);
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload | null => {
  return verifyTypedToken<RefreshTokenPayload>(token, TOKEN_TYPES.REFRESH);
};

export const verifyInviteToken = (token: string): InviteTokenPayload | null => {
  return verifyTypedToken<InviteTokenPayload>(token, TOKEN_TYPES.INVITE);
};

export const verifyPasswordResetToken = (token: string): PasswordResetTokenPayload | null => {
  return verifyTypedToken<PasswordResetTokenPayload>(token, TOKEN_TYPES.PASSWORD_RESET);
};
