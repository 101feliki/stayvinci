import { jwtVerify, SignJWT } from 'jose';
import type { PlatformRole } from '@stayvinci/types';
import type { AuthContext } from '../common/http.js';

const ISSUER = 'stayvinci-api';

/** Short-lived access token (HS256). Refresh tokens are opaque and stored hashed. */
export async function signAccessToken(
  secret: Uint8Array,
  ttlSeconds: number,
  ctx: AuthContext,
): Promise<string> {
  return new SignJWT({
    sid: ctx.sessionId,
    mfa: ctx.secondFactor,
    ...(ctx.platformRole ? { prole: ctx.platformRole } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(ctx.audience)
    .setSubject(ctx.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function verifyAccessToken(
  secret: Uint8Array,
  token: string,
): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: ['guest', 'business', 'console'],
      algorithms: ['HS256'],
    });
    const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
    if (
      !payload.sub ||
      typeof payload.sid !== 'string' ||
      (aud !== 'guest' && aud !== 'business' && aud !== 'console')
    )
      return null;
    return {
      userId: payload.sub,
      sessionId: payload.sid,
      audience: aud,
      secondFactor: payload.mfa === true,
      platformRole: (payload.prole as PlatformRole | undefined) ?? null,
    };
  } catch {
    return null;
  }
}
