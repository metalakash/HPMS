import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { Input } from '@/components/common/Field';
import { ErrorState } from '@/components/common/States';
import { Spinner } from '@/components/common/Spinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { getErrorMessage } from '@/services/api';
import { mfaApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/useAuthStore';

const STATUS_KEY = ['mfa', 'status'] as const;

/** The base32 seed inside an otpauth:// URI, for people who cannot scan the QR code. */
function seedFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

function Alert({ children }: { children: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </div>
  );
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-3" data-testid="backup-codes">
      <p className="text-sm">
        Save these backup codes somewhere safe. Each one signs you in once if you lose your authenticator. They
        are shown <strong>only now</strong>.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-md bg-surface-2 p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <Button onClick={onDone} className="self-start">
        I have saved them
      </Button>
    </div>
  );
}

function EnableFlow({ onEnabled }: { onEnabled: () => void }) {
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const setup = useMutation({ mutationFn: mfaApi.setup });
  const verify = useMutation({
    mutationFn: mfaApi.verify,
    onSuccess: async (result) => {
      if (!result.mfa_verified) return;
      // Codes are only available once MFA is on
      const generated = await mfaApi.backupCodes();
      setCodes(generated.codes);
    },
  });

  if (codes) return <BackupCodes codes={codes} onDone={onEnabled} />;

  if (!setup.data) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Two-step sign-in asks for a code from an authenticator app (such as Google Authenticator, Microsoft
          Authenticator or Authy) after your password.
        </p>
        {setup.isError && <Alert>{getErrorMessage(setup.error)}</Alert>}
        <Button onClick={() => setup.mutate()} loading={setup.isPending} className="self-start">
          Set up authenticator app
        </Button>
      </div>
    );
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    verify.mutate(code.trim());
  };
  const seed = seedFromUri(setup.data.totp_uri);
  const rejected = verify.data && !verify.data.mfa_verified;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Scan this QR code with your authenticator app.</li>
        <li>Enter the 6-digit code the app shows to confirm.</li>
      </ol>
      <img
        src={`data:image/png;base64,${setup.data.qr_code_base64}`}
        alt="QR code for your authenticator app"
        className="size-44 rounded-md border border-line bg-white p-2"
      />
      {seed && (
        <p className="text-sm text-muted">
          Cannot scan? Enter this key manually: <code className="font-mono text-fg">{seed}</code>
        </p>
      )}
      {(verify.isError || rejected) && (
        <Alert>{verify.isError ? getErrorMessage(verify.error) : 'That code is not valid. Try the next one.'}</Alert>
      )}
      <Input
        label="6-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
        required
      />
      <Button
        type="submit"
        loading={verify.isPending}
        disabled={code.trim().length !== 6}
        className="self-start"
      >
        Verify and turn on
      </Button>
    </form>
  );
}

function ManageFlow({ backupCodesAvailable, onDisabled }: { backupCodesAvailable: number; onDisabled: () => void }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState('');
  const regenerate = useMutation({ mutationFn: mfaApi.backupCodes, onSuccess: (r) => setCodes(r.codes) });
  const disable = useMutation({ mutationFn: mfaApi.disable, onSuccess: onDisabled });
  const queryClient = useQueryClient();

  if (codes) {
    return (
      <BackupCodes
        codes={codes}
        onDone={() => {
          setCodes(null);
          void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {backupCodesAvailable > 0
          ? `${backupCodesAvailable} backup code${backupCodesAvailable === 1 ? '' : 's'} left.`
          : 'You have no unused backup codes.'}
      </p>
      {regenerate.isError && <Alert>{getErrorMessage(regenerate.error)}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => regenerate.mutate()} loading={regenerate.isPending}>
          Generate new backup codes
        </Button>
        {!confirming && (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Turn off two-step sign-in
          </Button>
        )}
      </div>
      {confirming && (
        <form
          className="flex max-w-xs flex-col gap-3 rounded-md border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            disable.mutate(code.trim());
          }}
        >
          <p className="text-sm">Enter a current code or an unused backup code to confirm.</p>
          {disable.isError && <Alert>{getErrorMessage(disable.error)}</Alert>}
          <Input
            label="Code to confirm"
            name="confirm-code"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={disable.isPending} disabled={code.trim().length < 6}>
              Turn off
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const queryClient = useQueryClient();
  const clearRequired = useAuthStore((s) => s.clearMfaEnrollmentRequired);
  const status = useQuery({ queryKey: STATUS_KEY, queryFn: mfaApi.status });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
  };

  return (
    <>
      <PageHeader title="Security" description="Protect your account with two-step sign-in" />
      <Card className="max-w-2xl">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="size-4" aria-hidden="true" /> Two-step sign-in
            </span>
          }
          actions={
            status.data && (
              <Badge tone={status.data.is_enabled ? 'success' : 'warning'}>
                {status.data.is_enabled ? 'On' : 'Off'}
              </Badge>
            )
          }
        />
        <CardBody>
          {status.isPending && <Spinner />}
          {status.isError && <ErrorState error={status.error} onRetry={() => void status.refetch()} />}
          {status.data &&
            (status.data.is_enabled ? (
              <>
                <p className="mb-4 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                  Signing in asks for a code from your authenticator app.
                </p>
                <ManageFlow backupCodesAvailable={status.data.backup_codes_available} onDisabled={refresh} />
              </>
            ) : (
              <EnableFlow
                onEnabled={() => {
                  clearRequired();
                  refresh();
                }}
              />
            ))}
        </CardBody>
      </Card>
    </>
  );
}
