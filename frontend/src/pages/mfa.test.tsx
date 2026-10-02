import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';
import { tokenResponse } from '@/test/fixtures';
import { useAuthStore } from '@/store/useAuthStore';

const challenge = { mfa_required: true, mfa_token: 'challenge-token', expires_in_seconds: 300, methods: ['totp'] };

/** Password login answers with a challenge; the second step accepts 123456 or the backup code ABCD-1234. */
function mfaHandlers(options: { expired?: boolean } = {}) {
  const seen: { body?: unknown } = {};
  server.use(
    http.post('*/api/v1/auth/login', () => HttpResponse.json(challenge)),
    http.post('*/api/v1/auth/login/mfa', async ({ request }) => {
      const body = (await request.json()) as { mfa_token: string; code: string };
      seen.body = body;
      if (options.expired) {
        return HttpResponse.json({ detail: 'Sign-in session expired; sign in again' }, { status: 401 });
      }
      if (body.mfa_token === 'challenge-token' && ['123456', 'ABCD-1234'].includes(body.code)) {
        return HttpResponse.json(tokenResponse);
      }
      return HttpResponse.json({ detail: 'Invalid code' }, { status: 401 });
    }),
  );
  return seen;
}

async function enterPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Username'), 'ram.sharma');
  await user.type(screen.getByLabelText('Password'), 'correct');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('two-step sign-in', () => {
  it('asks for a code instead of signing in when the account has MFA', async () => {
    const user = userEvent.setup();
    mfaHandlers();
    renderRoute('/login');
    await enterPassword(user);

    expect(await screen.findByLabelText('Authentication code')).toBeInTheDocument();
    expect(screen.getByText('Signing in as ram.sharma')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull(); // the password alone is not a session
  });

  it('completes the sign-in with an authenticator code and returns to the requested page', async () => {
    const user = userEvent.setup();
    const seen = mfaHandlers();
    const { router } = renderRoute('/loans');
    await enterPassword(user);

    await user.type(await screen.findByLabelText('Authentication code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('heading', { name: 'Loan accounts' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/loans');
    expect(seen.body).toEqual({ mfa_token: 'challenge-token', code: '123456' });
    expect(useAuthStore.getState().user?.username).toBe('ram.sharma');
  });

  it('accepts a backup code', async () => {
    const user = userEvent.setup();
    mfaHandlers();
    renderRoute('/login');
    await enterPassword(user);

    await user.type(await screen.findByLabelText('Authentication code'), 'ABCD-1234');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(useAuthStore.getState().token).toBe('test-token'));
  });

  it('shows the error for a wrong code, clears the field and lets the user retry', async () => {
    const user = userEvent.setup();
    mfaHandlers();
    renderRoute('/login');
    await enterPassword(user);

    const input = await screen.findByLabelText('Authentication code');
    await user.type(input, '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid code');
    await waitFor(() => expect(input).toHaveValue(''));
    expect(useAuthStore.getState().token).toBeNull();

    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(useAuthStore.getState().token).toBe('test-token'));
  });

  it('keeps Verify disabled until the code is long enough', async () => {
    const user = userEvent.setup();
    mfaHandlers();
    renderRoute('/login');
    await enterPassword(user);
    await screen.findByLabelText('Authentication code');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });

  it('returns to the password step when the sign-in session has expired', async () => {
    const user = userEvent.setup();
    mfaHandlers({ expired: true });
    renderRoute('/login');
    await enterPassword(user);

    await user.type(await screen.findByLabelText('Authentication code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in session expired');
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
  });

  it('lets the user back out to try another account', async () => {
    const user = userEvent.setup();
    mfaHandlers();
    renderRoute('/login');
    await enterPassword(user);

    await user.click(await screen.findByRole('button', { name: 'Use a different account' }));
    expect(await screen.findByLabelText('Password')).toHaveValue('');
  });

  it('does not drop a session or redirect when a wrong code gives 401', async () => {
    const user = userEvent.setup();
    mfaHandlers();
    const { router } = renderRoute('/login');
    await enterPassword(user);
    await user.type(await screen.findByLabelText('Authentication code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByRole('alert');
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('Security page', () => {
  const status = (over: object = {}) =>
    http.get('*/api/v1/mfa/status', () =>
      HttpResponse.json({
        is_enabled: false,
        primary_method: null,
        totp_enabled: false,
        backup_codes_available: 0,
        mfa_required: false,
        ...over,
      }),
    );

  it('is in the menu for every role', async () => {
    signIn({ roles: ['maker'] });
    server.use(status());
    renderRoute('/');
    expect(await screen.findByRole('link', { name: /Security/ })).toBeInTheDocument();
  });

  it('walks through enrolment: QR code, confirmation, then one-time backup codes', async () => {
    const user = userEvent.setup();
    signIn();
    let enabled = false;
    server.use(
      http.get('*/api/v1/mfa/status', () =>
        HttpResponse.json({
          is_enabled: enabled,
          primary_method: enabled ? 'totp' : null,
          totp_enabled: enabled,
          backup_codes_available: enabled ? 10 : 0,
          mfa_required: false,
        }),
      ),
      http.post('*/api/v1/mfa/setup', () =>
        HttpResponse.json({
          totp_uri: 'otpauth://totp/SBL%20HPMS:ram?secret=JBSWY3DPEHPK3PXP&issuer=SBL%20HPMS',
          qr_code_base64: 'iVBORw0KGgo=',
        }),
      ),
      http.post('*/api/v1/mfa/verify', async ({ request }) => {
        const { code } = (await request.json()) as { code: string };
        enabled = code === '123456';
        return HttpResponse.json({ success: enabled, message: '', mfa_verified: enabled });
      }),
      http.post('*/api/v1/mfa/backup-codes', () =>
        HttpResponse.json({ codes: ['AAAA-1111', 'BBBB-2222'], message: 'ok' }),
      ),
    );
    renderRoute('/security');

    await user.click(await screen.findByRole('button', { name: 'Set up authenticator app' }));
    expect(await screen.findByAltText('QR code for your authenticator app')).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();

    await user.type(screen.getByLabelText('6-digit code'), '999999');
    await user.click(screen.getByRole('button', { name: 'Verify and turn on' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid');

    const input = screen.getByLabelText('6-digit code');
    await user.clear(input);
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and turn on' }));

    const codes = await screen.findByTestId('backup-codes');
    expect(codes).toHaveTextContent('AAAA-1111');
    await user.click(screen.getByRole('button', { name: 'I have saved them' }));
    expect(await screen.findByText('10 backup codes left.')).toBeInTheDocument();
  });

  it('turns MFA off only after a code is confirmed', async () => {
    const user = userEvent.setup();
    signIn();
    let enabled = true;
    server.use(
      http.get('*/api/v1/mfa/status', () =>
        HttpResponse.json({
          is_enabled: enabled,
          primary_method: 'totp',
          totp_enabled: enabled,
          backup_codes_available: 3,
          mfa_required: false,
        }),
      ),
      http.delete('*/api/v1/mfa/disable', async ({ request }) => {
        const { code } = (await request.json()) as { code: string };
        if (code !== '123456') return HttpResponse.json({ detail: 'Invalid code' }, { status: 403 });
        enabled = false;
        return HttpResponse.json({ message: 'MFA disabled' });
      }),
    );
    renderRoute('/security');

    await user.click(await screen.findByRole('button', { name: 'Turn off two-step sign-in' }));
    await user.type(screen.getByLabelText('Code to confirm'), '000000');
    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid code');
    expect(useAuthStore.getState().token).toBe('test-token'); // a refused code is not a logout

    const input = screen.getByLabelText('Code to confirm');
    await user.clear(input);
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByRole('button', { name: 'Set up authenticator app' })).toBeInTheDocument();
  });

  it('nags users whose role requires MFA until they enrol', async () => {
    signIn();
    useAuthStore.setState({ mfaEnrollmentRequired: true });
    server.use(status());
    const { router } = renderRoute('/');
    const link = await screen.findByRole('link', { name: 'Set it up now' });
    expect(link).toHaveAttribute('href', '/security');
    router.navigate('/security');
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Set it up now' })).not.toBeInTheDocument());
  });
});
