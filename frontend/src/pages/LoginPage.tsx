import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Droplets } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Field';
import { getErrorMessage } from '@/services/api';
import { authApi } from '@/services/endpoints';
import { isSessionValid, useAuthStore } from '@/store/useAuthStore';

export default function LoginPage() {
  const valid = useAuthStore(isSessionValid);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (response) => {
      setSession(response);
      navigate(from, { replace: true });
    },
  });

  if (valid) return <Navigate to={from} replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ username: username.trim(), password });
  };

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Droplets className="size-10 text-primary" aria-hidden="true" />
          <h1 className="text-h2 font-semibold">Sign in to HPMS</h1>
          <p className="text-sm text-muted">Use your bank directory (AD) credentials</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6"
          noValidate
        >
          {login.isError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {getErrorMessage(login.error)}
            </div>
          )}
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
        </form>
      </div>
    </main>
  );
}
