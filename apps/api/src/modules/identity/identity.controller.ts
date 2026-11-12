import { Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  Accepted,
  EmailTokenBody,
  MagicLinkRequest,
  MagicLinkVerify,
  OtpRequest,
  OtpRequested,
  OtpVerify,
  PasswordForgot,
  PasswordLogin,
  PasswordReset,
  RefreshBody,
  Tokens,
  TotpCode,
  TotpSetup,
} from '@stayvinci/types';
import type { z } from 'zod';
import { Errors, type AppRequest } from '../../common/http.js';
import { DocBody, DocResponse, ValidBody } from '../../common/validation.js';
import { Public } from '../../security/guards.js';
import { IdentityService, type ClientInfo } from './identity.service.js';

// Sign-in endpoints get a much lower rate limit than the rest of the API.
const STRICT = { default: { limit: 10, ttl: 60_000 } };

const client = (req: AppRequest): ClientInfo => ({
  ip: req.ip ?? null,
  userAgent: req.header('user-agent') ?? null,
  requestId: req.requestId,
});

@ApiTags('Sign-in')
@Controller('v1/auth')
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

  @Post('otp/request')
  @Public()
  @Throttle(STRICT)
  @HttpCode(202)
  @ApiOperation({
    summary: 'Send a sign-in code by SMS',
    description:
      '**On hold: answers 503 `sms_sign_in_off` while `SMS_PROVIDER=off` (the default). Use email sign-in.** Sends a 6-digit code valid for 5 minutes. Up to 3 codes per number per 10 minutes. The response is the same whether or not the number has an account.',
  })
  @DocBody(OtpRequest)
  @DocResponse(202, OtpRequested, 'Code sent', [422, 429, 503])
  requestOtp(@ValidBody(OtpRequest) body: z.output<typeof OtpRequest>) {
    return this.identity.requestOtp(body.phone);
  }

  @Post('otp/verify')
  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in with the SMS code',
    description:
      '**On hold while `SMS_PROVIDER=off`.** Creates a guest account on first sign-in (guest and business apps). Console sign-in only works for Stayvinci staff. Check `second_factor` in the response: owners and staff must complete two-step verification before using protected areas.',
  })
  @DocBody(OtpVerify)
  @DocResponse(200, Tokens, 'Signed in', [422, 429, 503])
  verifyOtp(@ValidBody(OtpVerify) body: z.output<typeof OtpVerify>, @Req() req: AppRequest) {
    return this.identity.verifyOtp(body.phone, body.code, body.audience, client(req));
  }

  @Post('magic-link')
  @Public()
  @Throttle(STRICT)
  @HttpCode(202)
  @ApiOperation({
    summary: 'Email a one-time sign-in link',
    description:
      'Valid for 15 minutes, works once. Always answers "accepted" so it never reveals which emails have accounts.',
  })
  @DocBody(MagicLinkRequest)
  @DocResponse(202, Accepted, 'Link sent if the email has an account', [422, 429])
  async magicLink(@ValidBody(MagicLinkRequest) body: z.output<typeof MagicLinkRequest>) {
    await this.identity.requestMagicLink(body.email, body.audience);
    return { accepted: true as const };
  }

  @Post('magic-link/verify')
  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in with an emailed link',
    description: 'Also marks the email address as verified.',
  })
  @DocBody(MagicLinkVerify)
  @DocResponse(200, Tokens, 'Signed in', [422, 429])
  verifyMagicLink(
    @ValidBody(MagicLinkVerify) body: z.output<typeof MagicLinkVerify>,
    @Req() req: AppRequest,
  ) {
    return this.identity.verifyMagicLink(body.token, body.audience, client(req));
  }

  @Post('password/login')
  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'For Stayvinci staff and owners who set a password. Two-step verification follows.',
  })
  @DocBody(PasswordLogin)
  @DocResponse(200, Tokens, 'Password accepted', [401, 422, 429])
  passwordLogin(
    @ValidBody(PasswordLogin) body: z.output<typeof PasswordLogin>,
    @Req() req: AppRequest,
  ) {
    return this.identity.passwordLogin(body.email, body.password, client(req));
  }

  @Post('password/forgot')
  @Public()
  @Throttle(STRICT)
  @HttpCode(202)
  @ApiOperation({
    summary: 'Email a password-reset link',
    description: 'Valid for 30 minutes. Always answers "accepted".',
  })
  @DocBody(PasswordForgot)
  @DocResponse(202, Accepted, 'Link sent if the email has an account', [422, 429])
  async forgot(@ValidBody(PasswordForgot) body: z.output<typeof PasswordForgot>) {
    await this.identity.forgotPassword(body.email);
    return { accepted: true as const };
  }

  @Post('password/reset')
  @Public()
  @Throttle(STRICT)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Set a new password from a reset link',
    description: 'Signs the person out of every other session.',
  })
  @DocBody(PasswordReset)
  @DocResponse(204, null, 'Password changed', [422, 429])
  async reset(@ValidBody(PasswordReset) body: z.output<typeof PasswordReset>) {
    await this.identity.resetPassword(body.token, body.password);
  }

  @Post('email/verify')
  @Public()
  @Throttle(STRICT)
  @HttpCode(204)
  @ApiOperation({ summary: 'Confirm an email address (activation link)' })
  @DocBody(EmailTokenBody)
  @DocResponse(204, null, 'Email confirmed', [422, 429])
  async verifyEmail(@ValidBody(EmailTokenBody) body: z.output<typeof EmailTokenBody>) {
    await this.identity.verifyEmail(body.token);
  }

  @Post('email/verification')
  @ApiBearerAuth('access-token')
  @Throttle(STRICT)
  @HttpCode(202)
  @ApiOperation({
    summary: 'Send me an activation email',
    description: 'Emails a link to confirm my address. Valid for 24 hours.',
  })
  @DocResponse(202, Accepted, 'Sent (or already verified)', [400, 401, 429])
  async sendVerification(@Req() req: AppRequest) {
    if (!req.auth) throw Errors.unauthorized();
    await this.identity.sendEmailVerification(req.auth.userId);
    return { accepted: true as const };
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get a new access token',
    description: 'The refresh token rotates: the old one stops working.',
  })
  @DocBody(RefreshBody)
  @DocResponse(200, Tokens, 'New tokens', [401, 422])
  refresh(@ValidBody(RefreshBody) body: z.output<typeof RefreshBody>) {
    return this.identity.refresh(body.refresh_token);
  }

  @Post('logout')
  @ApiBearerAuth('access-token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out of this session' })
  @DocResponse(204, null, 'Signed out', [401])
  async logout(@Req() req: AppRequest) {
    if (!req.auth) throw Errors.unauthorized();
    await this.identity.logout(req.auth.userId, req.auth.sessionId);
  }

  @Post('totp/setup')
  @ApiBearerAuth('access-token')
  @Throttle(STRICT)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Start two-step verification setup',
    description:
      'Returns a secret and an otpauth:// link (show as a QR code). Confirm with /totp/enable.',
  })
  @DocResponse(200, TotpSetup, 'Secret created', [401, 409, 429])
  totpSetup(@Req() req: AppRequest) {
    if (!req.auth) throw Errors.unauthorized();
    return this.identity.totpSetup(req.auth.userId);
  }

  @Post('totp/enable')
  @ApiBearerAuth('access-token')
  @Throttle(STRICT)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Turn on two-step verification',
    description: 'Confirms the first code and upgrades this session.',
  })
  @DocBody(TotpCode)
  @DocResponse(200, Tokens, 'Enabled; new tokens issued', [400, 401, 409, 422, 429])
  totpEnable(@ValidBody(TotpCode) body: z.output<typeof TotpCode>, @Req() req: AppRequest) {
    if (!req.auth) throw Errors.unauthorized();
    return this.identity.totpEnable(
      req.auth.userId,
      req.auth.sessionId,
      body.code,
      req.auth.audience,
    );
  }

  @Post('totp/verify')
  @ApiBearerAuth('access-token')
  @Throttle(STRICT)
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete two-step verification at sign-in' })
  @DocBody(TotpCode)
  @DocResponse(200, Tokens, 'Verified; new tokens issued', [400, 401, 422, 429])
  totpVerify(@ValidBody(TotpCode) body: z.output<typeof TotpCode>, @Req() req: AppRequest) {
    if (!req.auth) throw Errors.unauthorized();
    return this.identity.totpVerify(
      req.auth.userId,
      req.auth.sessionId,
      body.code,
      req.auth.audience,
    );
  }
}
