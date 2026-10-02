import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Droplets, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Field';
import { getErrorMessage } from '@/services/api';
import { authApi } from '@/services/endpoints';
import { isSessionValid, useAuthStore } from '@/store/useAuthStore';
import { isMfaChallenge, type TokenResponse } from '@/types/api';

export default function LoginPage() {
  const valid = useAuthStore(isSessionValid);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Set once the password is accepted and the account has MFA on; cleared to start over
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  // Why we are back at the password step (an expired sign-in session), shown until the next attempt
  const [notice, setNotice] = useState('');

  const finish = (response: TokenResponse) => {
    setSession(response);
    navigate(from, { replace: true });
  };

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (response) => {
      if (isMfaChallenge(response)) {
        setChallenge(response.mfa_token);
        setPassword(''); // not needed any more, do not keep it in memory
      } else {
        finish(response);
      }
    },
  });

  const verify = useMutation({
    mutationFn: authApi.loginMfa,
    onSuccess: finish,
    onError: (error) => {
      // An expired sign-in session cannot be retried with another code: go back to the password step
      const message = getErrorMessage(error);
      if (/expired/i.test(message)) {
        setNotice(message);
        setChallenge(null);
      }
      setCode('');
    },
  });

  if (valid) return <Navigate to={from} replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setNotice('');
    login.mutate({ username: username.trim(), password });
  };

  const onVerify = (e: FormEvent) => {
    e.preventDefault();
    if (challenge) verify.mutate({ mfa_token: challenge, code: code.trim() });
  };

  const backToPassword = () => {
    setChallenge(null);
    setCode('');
    verify.reset();
    login.reset();
  };

  const activeError = challenge ? verify : login;
  const errorText = notice || (activeError.isError ? getErrorMessage(activeError.error) : '');

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Droplets className="size-10 text-primary" aria-hidden="true" />
          <h1 className="text-h2 font-semibold">Sign in to HPMS</h1>
          <p className="text-sm text-muted">
            {challenge
              ? 'Enter the code from your authenticator app'
              : 'Use your bank directory (AD) credentials'}
          </p>
        </div>
        <form
          onSubmit={challenge ? onVerify : onSubmit}
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6"
          noValidate
        >
          {errorText && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {errorText}
            </div>
          )}

          {challenge ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                Signing in as {username.trim()}
              </div>
              <Input
                label="Authentication code"
                name="code"
                inputMode="text"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
                autoFocus
              />
              <p className="-mt-2 text-xs text-muted">
                Lost your device? Enter one of your backup codes (like ABCD-1234) instead. Each works once.
              </p>
              <Button
                type="submit"
                loading={verify.isPending}
                disabled={code.trim().length < 6}
                className="mt-2 w-full"
              >
                Verify
              </Button>
              <Button type="button" variant="ghost" onClick={backToPassword} className="w-full">
                Use a different account
              </Button>
            </>
          ) : (
            <>
              <Input
                label="Username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                loading={login.isPending}
                disabled={!username.trim() || !password}
                className="mt-2 w-full"
              >
                Sign in
              </Button>
            </>
          )}
        </form>
      </div>
    </main>
  );
}
