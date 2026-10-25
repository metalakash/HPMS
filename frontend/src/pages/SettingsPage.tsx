import { useState } from 'react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Input, Select } from '@/components/common/Field';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { JustificationModal } from '@/components/modals/JustificationModal';
import { getErrorMessage } from '@/services/api';
import {
  type AppSetting, type ApprovalRule, type CurrencyRates, useApprovalRules, useExchangeRates, useProposeChange, useSettings,
} from '@/services/changeRequests';
import { humanize } from '@/utils/format';

const CHECKERS = ['approver', 'admin'] as const;
const roleList = (roles: string[]) => roles.map((r) => humanize(r)).join(' or ') || '—';

function SettingModal({ setting, onClose, onSubmitted }: { setting: AppSetting; onClose: () => void; onSubmitted: (m: string) => void }) {
  const propose = useProposeChange('SETTING');
  const [value, setValue] = useState(String(Number(setting.value)));
  const number = Number(value);
  const problem = value.trim() === '' || Number.isNaN(number) ? 'Enter a number'
    : setting.integer && !Number.isInteger(number) ? `A whole number of ${setting.unit}`
      : number < Number(setting.minimum) || number > Number(setting.maximum) ? `Between ${Number(setting.minimum)} and ${Number(setting.maximum)} ${setting.unit}`
        : number === Number(setting.value) ? 'This is the current value' : null;
  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Setting"
      entityId={setting.name}
      actionName={`changing ${setting.label.toLowerCase()}`}
      isLoading={propose.isPending}
      canSubmit={!problem}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await propose.mutateAsync({ entityId: setting.name, changes: { value: value.trim() }, justification: reason });
        } catch (error) {
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted(`${setting.label}: change to ${value.trim()} ${setting.unit} sent for approval.`);
      }}
    >
      <p className="mb-3 text-sm text-muted">{setting.description}</p>
      <Input
        label={`${setting.label} (${setting.unit})`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={problem && problem !== 'This is the current value' ? problem : undefined}
      />
      <p className="mt-2 text-xs text-muted">Current {Number(setting.value)} {setting.unit}; default {Number(setting.default)} {setting.unit}.</p>
    </JustificationModal>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Propose a rate for a currency from a date. Rates are added, never edited. */
function RateModal({ currency, onClose, onSubmitted }: { currency: string | null; onClose: () => void; onSubmitted: (m: string) => void }) {
  const propose = useProposeChange('EXCHANGE_RATE');
  const [code, setCode] = useState(currency ?? '');
  const [rate, setRate] = useState('');
  const [from, setFrom] = useState(todayIso());
  const [source, setSource] = useState('');
  const codeOk = /^[A-Z]{3}$/.test(code) && code !== 'NPR';
  const rateOk = /^\d+(\.\d{1,6})?$/.test(rate.trim()) && Number(rate) > 0;
  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Exchange rate"
      entityId={code || 'new'}
      actionName={`adding an exchange rate for ${code || 'a currency'}`}
      isLoading={propose.isPending}
      canSubmit={codeOk && rateOk && Boolean(from) && source.trim().length >= 3}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await propose.mutateAsync({ entityId: code, changes: { rate_to_npr: rate.trim(), effective_from_ad: from, source_reference: source.trim() }, justification: reason });
        } catch (error) {
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted(`${code} rate of ${rate.trim()} NPR from ${from} sent for approval.`);
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Currency" placeholder="USD" maxLength={3} value={code} disabled={Boolean(currency)}
          onChange={(e) => setCode(e.target.value.toUpperCase())} error={code && !codeOk ? 'A three-letter code other than NPR' : undefined} />
        <Input label="NPR per unit" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)}
          error={rate && !rateOk ? 'Above zero, at most six decimals' : undefined} />
        <Input label="In force from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Source" placeholder="NRB reference rate" value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
    </JustificationModal>
  );
}

function RoleBoxes({ list, set, name }: { list: string[]; set: (v: string[]) => void; name: string }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{name}</legend>
      {CHECKERS.map((role) => (
        <label key={role} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={list.includes(role)}
            onChange={() => set(list.includes(role) ? list.filter((r) => r !== role) : [...list, role])}
          />
          {humanize(role)}
        </label>
      ))}
    </fieldset>
  );
}

function RuleModal({ rule, onClose, onSubmitted }: { rule: ApprovalRule; onClose: () => void; onSubmitted: (m: string) => void }) {
  const propose = useProposeChange('APPROVAL_RULE');
  const [twoStep, setTwoStep] = useState(rule.steps.includes('recommended'));
  const [recommend, setRecommend] = useState<string[]>(rule.recommend_roles.length ? rule.recommend_roles : [...CHECKERS]);
  const [approve, setApprove] = useState<string[]>(rule.approve_roles);
  const sameAsNow = twoStep === rule.steps.includes('recommended')
    && [...approve].sort().join() === [...rule.approve_roles].sort().join()
    && (!twoStep || [...recommend].sort().join() === [...rule.recommend_roles].sort().join());
  const problem = approve.length === 0 || (twoStep && recommend.length === 0) ? 'Choose who may give each check' : sameAsNow ? 'This is the current rule' : null;
  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Approval rule"
      entityId={rule.entity_type}
      actionName={`changing who approves ${rule.label.toLowerCase()}`}
      isLoading={propose.isPending}
      canSubmit={!problem}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        const changes = twoStep
          ? { steps: ['submitted', 'recommended', 'approved'], recommend_roles: recommend, approve_roles: approve }
          : { steps: ['submitted', 'approved'], approve_roles: approve };
        try {
          await propose.mutateAsync({ entityId: rule.entity_type, changes, justification: reason });
        } catch (error) {
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted(`New approval rule for ${rule.label.toLowerCase()} sent for approval. Requests already raised keep the current rule.`);
      }}
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Checks"
          value={twoStep ? 'two' : 'one'}
          onChange={(e) => setTwoStep(e.target.value === 'two')}
          options={[
            { value: 'two', label: 'A recommendation, then a final approval by someone else' },
            { value: 'one', label: 'A single approval' },
          ]}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {twoStep && <RoleBoxes list={recommend} set={setRecommend} name="Who may recommend" />}
          <RoleBoxes list={approve} set={setApprove} name="Who may give the final approval" />
        </div>
        <p className="text-xs text-muted">Whatever the rule, nobody checks a change they proposed.</p>
        {problem && <p className="text-sm text-danger">{problem}</p>}
      </div>
    </JustificationModal>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const rules = useApprovalRules();
  const rates = useExchangeRates();
  const [addingRate, setAddingRate] = useState<string | null | false>(false);
  const [editingSetting, setEditingSetting] = useState<AppSetting | null>(null);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const done = (message: string) => { setNotice(message); setEditingSetting(null); setEditingRule(null); setAddingRate(false); };
  const rateColumns: Column<CurrencyRates>[] = [
    { key: 'code', header: 'Currency', render: (c) => c.currency_code },
    {
      key: 'current',
      header: 'NPR per unit',
      align: 'right',
      render: (c) => (c.current ? <span>{Number(c.current.rate_to_npr)}<span className="block text-xs text-muted">from {c.current.effective_from_ad}</span></span> : 'Not yet in force'),
    },
    { key: 'source', header: 'Source', hideOnMobile: true, render: (c) => c.current?.source_reference ?? '—' },
    { key: 'history', header: 'Rates on file', align: 'right', hideOnMobile: true, render: (c) => c.history.length },
    { key: 'actions', header: '', align: 'right', render: (c) => <Button variant="ghost" size="sm" onClick={() => setAddingRate(c.currency_code)}>New rate</Button> },
  ];

  const settingColumns: Column<AppSetting>[] = [
    { key: 'label', header: 'Setting', render: (s) => <span>{s.label}<span className="block text-xs text-muted">{s.description}</span></span> },
    { key: 'group', header: 'Area', hideOnMobile: true, render: (s) => s.group },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      render: (s) => (
        <span className="whitespace-nowrap">
          {Number(s.value)} {s.unit}
          {!s.is_default && <span className="block text-xs text-muted">Default {Number(s.default)}</span>}
        </span>
      ),
    },
    { key: 'actions', header: '', align: 'right', render: (s) => <Button variant="ghost" size="sm" onClick={() => setEditingSetting(s)}>Change</Button> },
  ];
  const ruleColumns: Column<ApprovalRule>[] = [
    { key: 'type', header: 'Change', render: (r) => r.label },
    {
      key: 'steps',
      header: 'Checks',
      render: (r) => <Badge tone={r.steps.includes('recommended') ? 'info' : 'warning'}>{r.steps.includes('recommended') ? 'Two' : 'One'}</Badge>,
    },
    { key: 'recommend', header: 'Recommended by', hideOnMobile: true, render: (r) => (r.steps.includes('recommended') ? roleList(r.recommend_roles) : '—') },
    { key: 'approve', header: 'Approved by', render: (r) => roleList(r.approve_roles) },
    { key: 'actions', header: '', align: 'right', render: (r) => <Button variant="ghost" size="sm" onClick={() => setEditingRule(r)}>Change</Button> },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Values the application works with, and who approves each kind of change. Every change needs a second administrator." />
      {notice && <p role="status" className="mb-4 rounded-md bg-success-soft p-3 text-sm text-success">{notice} Track it under Approvals.</p>}
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Application settings" description="Alert lead times and the covenant thresholds for facilities without sanction terms of their own" />
          <CardBody>
            {settings.isError ? <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
              : !settings.data ? <Skeleton className="h-40 w-full" />
                : <DataTable caption="Application settings" columns={settingColumns} rows={settings.data} rowKey={(s) => s.name} />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Exchange rates"
            description="NPR per unit of each currency a facility is held in, in force from a date until the next rate"
            actions={<Button variant="secondary" size="sm" onClick={() => setAddingRate(null)}>Add a currency</Button>}
          />
          <CardBody>
            {rates.isError ? <ErrorState error={rates.error} onRetry={() => void rates.refetch()} />
              : !rates.data ? <Skeleton className="h-24 w-full" />
                : <DataTable caption="Exchange rates" columns={rateColumns} rows={rates.data} rowKey={(c) => c.currency_code}
                    empty={<p className="p-4 text-sm text-muted">No rates on file. Every facility is in NPR until one is added.</p>} />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Approval rules" description="How many checks each kind of change needs, and from whom. A request keeps the rule it was raised under." />
          <CardBody>
            {rules.isError ? <ErrorState error={rules.error} onRetry={() => void rules.refetch()} />
              : !rules.data ? <Skeleton className="h-40 w-full" />
                : <DataTable caption="Approval rules" columns={ruleColumns} rows={rules.data} rowKey={(r) => r.entity_type} />}
          </CardBody>
        </Card>
      </div>
      {addingRate !== false && <RateModal currency={addingRate} onClose={() => setAddingRate(false)} onSubmitted={done} />}
      {editingSetting && <SettingModal setting={editingSetting} onClose={() => setEditingSetting(null)} onSubmitted={done} />}
      {editingRule && <RuleModal rule={editingRule} onClose={() => setEditingRule(null)} onSubmitted={done} />}
    </>
  );
}
