import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, Check, ChevronRight, CircleHelp, Lock, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import {
  getGetAssistantBehaviorSettingsQueryKey,
  useGetAssistantBehaviorSettings,
  useUpdateAssistantBehaviorSettings,
} from '@workspace/api-client-react';
import type { AssistantBehaviorSettingsUpdate } from '@workspace/api-client-react';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import TestSessions from './test-sessions';

type SettingsForm = AssistantBehaviorSettingsUpdate;

const EMPATHY_STAGES = [
  { name: 'Practical', range: '0–1' },
  { name: 'Courteous', range: '2–3' },
  { name: 'Acknowledging', range: '4–6' },
  { name: 'Warm', range: '7–8' },
  { name: 'Deeply attuned', range: '9–10' },
] as const;

const EMPATHY_PLACEHOLDERS = [
  'Facts only. e.g. “The MacBook Neo is ₹69,900 and suits coursework.”',
  'Polite and brief. e.g. “Thanks for the details — the MacBook Neo is the best fit here.”',
  'Name their situation once. e.g. “A tight budget makes this choice matter, so let’s get it right…”',
  'Warm and reassuring. e.g. “That’s a smart thing to be careful about — college costs add up…”',
  'Fully attuned. e.g. “I hear you — starting college on a tight budget can feel stressful…”',
] as const;

/** Same banding as the server: maps a 0–10 score to stage 0–4. */
function empathyStageIndex(scale: number) {
  return Math.min(4, Math.max(0, Math.round(scale / 2.5)));
}

function toFormValues(data: SettingsForm): SettingsForm {
  return {
    persona: data.persona,
    tone: data.tone,
    initiativeGoal: data.initiativeGoal,
    empathyExamples: [...data.empathyExamples],
    empathyScale: data.empathyScale,
    goalOrientationScale: data.goalOrientationScale,
  };
}

const defaults: SettingsForm = {
  persona: '',
  tone: '',
  initiativeGoal: '',
  empathyExamples: ['', '', '', '', ''],
  empathyScale: 5,
  goalOrientationScale: 5,
};

const PASSWORD_KEY = 'circuit-house-admin-password';
const ADMIN_PASSWORD_HEADER = 'x-admin-password';

function readStoredPassword() {
  try { return sessionStorage.getItem(PASSWORD_KEY) ?? ''; } catch { return ''; }
}
function storePassword(value: string | null) {
  try {
    if (value) sessionStorage.setItem(PASSWORD_KEY, value);
    else sessionStorage.removeItem(PASSWORD_KEY);
  } catch { /* storage unavailable: password lives only in memory */ }
}

type VerifyResult = { ok: true; passwordRequired: boolean } | { ok: false; reason: 'wrong' | 'unreachable' };

async function verifyAdminPassword(password: string): Promise<VerifyResult> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/shop/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (response.status === 401) return { ok: false, reason: 'wrong' };
    if (!response.ok) return { ok: false, reason: 'unreachable' };
    const body = await response.json() as { passwordRequired?: boolean };
    return { ok: true, passwordRequired: Boolean(body.passwordRequired) };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

type Gate =
  | { state: 'checking' }
  | { state: 'locked'; message?: string }
  | { state: 'open'; password: string; passwordRequired: boolean };

export default function Admin() {
  const [gate, setGate] = useState<Gate>({ state: 'checking' });

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredPassword();
    void verifyAdminPassword(stored).then((result) => {
      if (cancelled) return;
      if (result.ok) setGate({ state: 'open', password: stored, passwordRequired: result.passwordRequired });
      else {
        storePassword(null);
        setGate({ state: 'locked', message: result.reason === 'unreachable' ? 'We couldn’t reach the store server. Try again in a moment.' : undefined });
      }
    });
    return () => { cancelled = true; };
  }, []);

  const lock = (message?: string) => {
    storePassword(null);
    setGate({ state: 'locked', message });
  };

  return (
    <div className="admin-shell">
      <div className="admin-topline">Circuit House <span>/</span> assistant controls</div>
      <header className="admin-header">
        <Link href="/" className="brand admin-brand" data-testid="link-admin-store">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">circuit house</span>
        </Link>
        <Link href="/" className="admin-return" data-testid="link-return-store"><ArrowLeft size={14} /> Back to the store</Link>
      </header>
      {gate.state === 'open'
        ? <AdminSettings password={gate.password} passwordRequired={gate.passwordRequired} onLocked={lock} />
        : (
          <main className="admin-main">
            {gate.state === 'checking'
              ? <section className="admin-login" aria-busy="true" data-testid="loading-admin-gate"><span className="admin-skeleton admin-skeleton-title" /></section>
              : <AdminLogin message={gate.message} onUnlocked={(password, passwordRequired) => { storePassword(password); setGate({ state: 'open', password, passwordRequired }); }} />}
          </main>
        )}
    </div>
  );
}

function AdminLogin({ message, onUnlocked }: { message?: string; onUnlocked: (password: string, passwordRequired: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(message);
  const [checking, setChecking] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) { setError('Enter the admin password.'); return; }
    setChecking(true);
    const result = await verifyAdminPassword(password);
    setChecking(false);
    if (result.ok) onUnlocked(password, result.passwordRequired);
    else setError(result.reason === 'wrong' ? 'That password isn’t right. Check with whoever set up the store.' : 'We couldn’t reach the store server. Try again in a moment.');
  };

  return (
    <section className="admin-login" aria-labelledby="admin-login-title">
      <div className="admin-login-mark" aria-hidden="true"><Lock size={18} /></div>
      <div className="eyebrow">Assistant controls · Staff only</div>
      <h1 id="admin-login-title">Enter the admin password</h1>
      <p>These settings change how the shopping assistant talks to every visitor, so they’re locked.</p>
      <form onSubmit={(event) => void submit(event)} className="admin-login-form">
        <label htmlFor="admin-password" className="admin-field-label">Password</label>
        <div className="admin-login-row">
          <input id="admin-password" type="password" autoComplete="current-password" className="admin-login-input" value={password} onChange={(event) => { setPassword(event.target.value); setError(undefined); }} data-testid="input-admin-password" />
          <button type="submit" className="admin-save-button" disabled={checking} data-testid="button-admin-unlock">{checking ? 'Checking…' : 'Unlock'}</button>
        </div>
        <div className="admin-login-error" role="alert" data-testid="text-admin-login-error">{error ?? ''}</div>
      </form>
    </section>
  );
}

function AdminSettings({ password, passwordRequired, onLocked }: { password: string; passwordRequired: boolean; onLocked: (message?: string) => void }) {
  const queryClient = useQueryClient();
  const settingsQuery = useGetAssistantBehaviorSettings({
    query: { queryKey: getGetAssistantBehaviorSettingsQueryKey() },
  });
  const saveSettings = useUpdateAssistantBehaviorSettings({
    request: { headers: password ? { [ADMIN_PASSWORD_HEADER]: password } : {} },
  });
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const form = useForm<SettingsForm>({ defaultValues: defaults, mode: 'onChange' });
  const { reset } = form;

  useEffect(() => {
    if (settingsQuery.data) {
      reset(toFormValues(settingsQuery.data));
    }
  }, [settingsQuery.data, reset]);

  const submit = form.handleSubmit((values) => {
    setSaveFailed(false);
    setSaved(false);
    saveSettings.mutate({ data: values }, {
      onSuccess: (updated) => {
        reset(toFormValues(updated));
        setSaved(true);
        void queryClient.invalidateQueries({ queryKey: getGetAssistantBehaviorSettingsQueryKey() });
      },
      onError: (error) => {
        if ((error as { status?: number } | null)?.status === 401) {
          onLocked('Your session needs the admin password again. Your unsaved edits were not kept.');
          return;
        }
        setSaveFailed(true);
      },
    });
  });

  const isDirty = form.formState.isDirty;
  const updatedAt = settingsQuery.data?.updatedAt
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(settingsQuery.data.updatedAt))
    : null;

  return (
      <main className="admin-main">
        <div className="admin-breadcrumb" aria-label="Page location"><span>Store tools</span><ChevronRight size={12} /><strong>Assistant behavior</strong></div>
        <div className="admin-heading">
          <div>
            <div className="eyebrow">Public shopping guide · Configuration</div>
            <h1>Set the way we<br className="admin-title-break" /> help people choose.</h1>
            <p>Shape the voice and approach of Circuit House’s catalog-grounded assistant. Changes apply to future conversations.</p>
          </div>
          <div className="admin-heading-mark" aria-hidden="true"><SlidersHorizontal size={27} strokeWidth={1.2} /><span>CH / 01</span></div>
        </div>

        {!passwordRequired && <aside className="admin-access-warning" role="note" data-testid="notice-admin-access">
          <div className="admin-warning-icon"><AlertTriangle size={17} /></div>
          <div>
            <strong>This page has no login.</strong>
            <p>Anyone who visits <code>/admin</code> can change the assistant’s public settings. Set an <code>ADMIN_PASSWORD</code> on the server before sharing the store.</p>
          </div>
          <span className="warning-flag">Access note</span>
        </aside>}

        {settingsQuery.isLoading ? (
          <section className="admin-loading" aria-label="Loading assistant settings" data-testid="loading-assistant-settings">
            <div className="admin-loading-top"><span className="admin-skeleton admin-skeleton-title" /><span className="admin-skeleton admin-skeleton-tag" /></div>
            <span className="admin-skeleton admin-skeleton-label" /><span className="admin-skeleton admin-skeleton-input" />
            <span className="admin-skeleton admin-skeleton-label" /><span className="admin-skeleton admin-skeleton-input" />
            <span className="admin-skeleton admin-skeleton-label" /><span className="admin-skeleton admin-skeleton-range" />
          </section>
        ) : settingsQuery.isError ? (
          <section className="admin-error" role="alert" data-testid="error-assistant-settings">
            <div className="admin-error-mark"><CircleHelp size={22} /></div>
            <div><h2>Settings aren’t available right now.</h2><p>We couldn’t load the assistant controls. Your saved settings have not been changed.</p></div>
            <button className="admin-retry" type="button" onClick={() => void settingsQuery.refetch()} data-testid="button-retry-settings"><RotateCcw size={14} /> Try again</button>
          </section>
        ) : (
          <Form {...form}>
            <form onSubmit={submit} className="admin-form" data-testid="form-assistant-settings">
              <section className="admin-panel" aria-labelledby="voice-title">
                <div className="admin-panel-head">
                  <div className="admin-panel-number">01</div>
                  <div><div className="admin-section-kicker">The words and the why</div><h2 id="voice-title">Voice &amp; point of view</h2></div>
                  <span className="admin-panel-index">VOICE</span>
                </div>
                <div className="admin-fields">
                  <FormField
                    control={form.control}
                    name="persona"
                    rules={{ required: 'Add a persona before saving.', maxLength: { value: 1200, message: 'Keep the persona under 1,200 characters.' } }}
                    render={({ field, fieldState }) => (
                      <FormItem className="admin-field">
                        <div className="admin-field-label-line"><FormLabel className="admin-field-label">Persona</FormLabel><span className="admin-char-count">{field.value.length} / 1,200</span></div>
                        <FormControl><textarea {...field} className="admin-textarea" rows={4} maxLength={1200} placeholder="Describe who the assistant is, what it knows, and how it should help." aria-label="Assistant persona" data-testid="input-assistant-persona" /></FormControl>
                        <div className="admin-field-foot"><span>{fieldState.error?.message ?? 'Ground the assistant in your shop, products, and practical expertise.'}</span></div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tone"
                    rules={{ required: 'Add a tone before saving.', maxLength: { value: 800, message: 'Keep the tone under 800 characters.' } }}
                    render={({ field, fieldState }) => (
                      <FormItem className="admin-field">
                        <div className="admin-field-label-line"><FormLabel className="admin-field-label">Tone</FormLabel><span className="admin-char-count">{field.value.length} / 800</span></div>
                        <FormControl><textarea {...field} className="admin-textarea admin-textarea-short" rows={3} maxLength={800} placeholder="Set the feel of each reply: measured, warm, direct…" aria-label="Assistant tone" data-testid="input-assistant-tone" /></FormControl>
                        <div className="admin-field-foot"><span>{fieldState.error?.message ?? 'A few words about pacing, warmth, and how direct to be.'}</span></div>
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <section className="admin-panel admin-slider-panel" aria-labelledby="approach-title">
                <div className="admin-panel-head">
                  <div className="admin-panel-number">02</div>
                  <div><div className="admin-section-kicker">How help should feel</div><h2 id="approach-title">Conversation approach</h2></div>
                  <span className="admin-panel-index">BALANCE</span>
                </div>
                <div className="admin-slider-list">
                  <RangeSetting
                    name="empathyScale"
                    control={form.control}
                    title="Empathy"
                    detail="How much the assistant acknowledges the person’s context, uncertainty, and priorities."
                    low="Matter-of-fact"
                    high="Highly considerate"
                    testId="slider-empathy"
                  />
                  <EmpathyExamples control={form.control} activeStage={empathyStageIndex(Number(form.watch('empathyScale')))} />
                  <RangeSetting
                    name="goalOrientationScale"
                    control={form.control}
                    title="Initiative"
                    detail="How actively it guides the shopper toward the conversation goal you define below."
                    low="Passive"
                    high="Goal-oriented"
                    testId="slider-goal-orientation"
                  />
                  <FormField
                    control={form.control}
                    name="initiativeGoal"
                    rules={{ required: 'Add a conversation goal before saving.', maxLength: { value: 1200, message: 'Keep the goal under 1,200 characters.' } }}
                    render={({ field, fieldState }) => (
                      <FormItem className="admin-goal-field">
                        <div className="admin-field-label-line">
                          <FormLabel className="admin-field-label">Conversation goal</FormLabel>
                          <span className="admin-char-count">{field.value.length} / 1,200</span>
                        </div>
                        <FormControl>
                          <textarea
                            {...field}
                            className="admin-textarea admin-goal-textarea"
                            rows={3}
                            maxLength={1200}
                            placeholder="Describe what you want the assistant to help shoppers accomplish."
                            aria-label="Assistant conversation goal"
                            data-testid="input-assistant-initiative-goal"
                          />
                        </FormControl>
                        <div className="admin-field-foot">
                          <span>{fieldState.error?.message ?? 'The initiative score controls how actively the assistant works toward this goal.'}</span>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="admin-range-note"><span>Both scales run from 0 to 10.</span><span>Recommendations use catalog facts and cited market sources.</span></div>
              </section>

              <div className="admin-savebar">
                <div className="admin-save-meta" aria-live="polite">
                  {saveSettings.isPending ? <><span className="save-dot saving" /><span data-testid="status-save-in-progress">Saving your changes…</span></>
                    : saveFailed ? <><span className="save-dot failed" /><span className="save-failure" data-testid="status-save-failure">Couldn’t save. Your edits are still here — try again.</span></>
                      : saved ? <><span className="save-dot complete"><Check size={11} /></span><span className="save-success" data-testid="status-saved">Changes saved{updatedAt ? ` · ${updatedAt}` : ''}</span></>
                        : isDirty ? <><span className="save-dot unsaved" /><span data-testid="status-unsaved">Unsaved changes</span></>
                          : <><span className="save-dot complete"><Check size={11} /></span><span data-testid="status-saved-current">{updatedAt ? `Last updated ${updatedAt}` : 'Settings are up to date'}</span></>}
                </div>
                <button type="submit" className="admin-save-button" disabled={saveSettings.isPending || !isDirty} data-testid="button-save-settings">
                  {saveSettings.isPending ? <><span className="save-button-pulse" /> Saving…</> : <><Save size={15} /> Save changes</>}
                </button>
              </div>
            </form>
          </Form>
        )}

        <TestSessions password={password} />

        <footer className="admin-footer"><span>Thoughtful tech. Clear answers.</span><span>Assistant controls <i>·</i> Circuit House</span></footer>
      </main>
  );
}

function EmpathyExamples({
  control, activeStage,
}: {
  control: ReturnType<typeof useForm<SettingsForm>>['control'];
  activeStage: number;
}) {
  return (
    <div className="empathy-examples" role="group" aria-labelledby="empathy-examples-title" data-testid="group-empathy-examples">
      <div className="empathy-examples-head">
        <span className="admin-field-label" id="empathy-examples-title">Empathy examples</span>
        <p>Write how the assistant should reply at each stage of the scale. It uses the stage your slider is on and the ones around it to judge how warm to sound. Tip: picture one shopper message — e.g. “I need a laptop for college but my budget is tight” — and answer it five ways.</p>
      </div>
      <ol className="empathy-stage-list">
        {EMPATHY_STAGES.map((stage, index) => (
          <FormField
            key={stage.name}
            control={control}
            name={`empathyExamples.${index}`}
            rules={{
              validate: (value) => value.trim().length > 0 || `Add an example for ${stage.name.toLowerCase()}.`,
              maxLength: { value: 500, message: 'Keep each example under 500 characters.' },
            }}
            render={({ field, fieldState }) => (
              <li className={`empathy-stage${index === activeStage ? ' is-active' : ''}`} data-testid={`empathy-stage-${index + 1}`}>
                <FormItem className="empathy-stage-item">
                  <div className="empathy-stage-meta">
                    <span className="empathy-stage-number">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <FormLabel className="empathy-stage-name">{stage.name}</FormLabel>
                      <span className="empathy-stage-range">Levels {stage.range}</span>
                    </div>
                    {index === activeStage && <span className="empathy-stage-current" data-testid="text-empathy-current-stage">In use</span>}
                  </div>
                  <div className="empathy-stage-input">
                    <FormControl>
                      <textarea
                        {...field}
                        className="admin-textarea empathy-stage-textarea"
                        rows={2}
                        maxLength={500}
                        placeholder={EMPATHY_PLACEHOLDERS[index]}
                        aria-label={`Empathy example, stage ${index + 1}: ${stage.name}`}
                        data-testid={`input-empathy-example-${index + 1}`}
                      />
                    </FormControl>
                    <div className="empathy-stage-foot">
                      <span className={fieldState.error ? 'empathy-stage-error' : undefined}>{fieldState.error?.message ?? ''}</span>
                      <span className="admin-char-count">{field.value.length} / 500</span>
                    </div>
                  </div>
                </FormItem>
              </li>
            )}
          />
        ))}
      </ol>
    </div>
  );
}

function RangeSetting({
  name, control, title, detail, low, high, testId,
}: {
  name: 'empathyScale' | 'goalOrientationScale';
  control: ReturnType<typeof useForm<SettingsForm>>['control'];
  title: string;
  detail: string;
  low: string;
  high: string;
  testId: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="admin-range-setting">
          <div className="range-title-row"><div><FormLabel className="admin-field-label">{title}</FormLabel><p>{detail}</p></div><output className="range-value" htmlFor={testId} data-testid={`value-${testId}`}>{field.value}<small>/ 10</small></output></div>
          <FormControl><input {...field} type="range" min={0} max={10} step={1} value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} className="admin-range" style={{ '--range-progress': `${Number(field.value) * 10}%` } as CSSProperties} id={testId} aria-label={title} data-testid={testId} /></FormControl>
          <div className="range-endpoints"><span><b>0</b>{low}</span><span>{high}<b>10</b></span></div>
        </FormItem>
      )}
    />
  );
}
