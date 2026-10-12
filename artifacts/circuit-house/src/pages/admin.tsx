import { useEffect, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, Check, ChevronRight, CircleHelp, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import {
  getGetAssistantBehaviorSettingsQueryKey,
  useGetAssistantBehaviorSettings,
  useUpdateAssistantBehaviorSettings,
} from '@workspace/api-client-react';
import type { AssistantBehaviorSettingsUpdate } from '@workspace/api-client-react';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';

type SettingsForm = AssistantBehaviorSettingsUpdate;

const defaults: SettingsForm = {
  persona: '',
  tone: '',
  initiativeGoal: '',
  empathyScale: 5,
  goalOrientationScale: 5,
};

export default function Admin() {
  const queryClient = useQueryClient();
  const settingsQuery = useGetAssistantBehaviorSettings({
    query: { queryKey: getGetAssistantBehaviorSettingsQueryKey() },
  });
  const saveSettings = useUpdateAssistantBehaviorSettings();
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const form = useForm<SettingsForm>({ defaultValues: defaults, mode: 'onChange' });
  const { reset } = form;

  useEffect(() => {
    if (settingsQuery.data) {
      reset({
        persona: settingsQuery.data.persona,
        tone: settingsQuery.data.tone,
        initiativeGoal: settingsQuery.data.initiativeGoal,
        empathyScale: settingsQuery.data.empathyScale,
        goalOrientationScale: settingsQuery.data.goalOrientationScale,
      });
    }
  }, [settingsQuery.data, reset]);

  const submit = form.handleSubmit((values) => {
    setSaveFailed(false);
    setSaved(false);
    saveSettings.mutate({ data: values }, {
      onSuccess: (updated) => {
        reset({
          persona: updated.persona,
          tone: updated.tone,
          initiativeGoal: updated.initiativeGoal,
          empathyScale: updated.empathyScale,
          goalOrientationScale: updated.goalOrientationScale,
        });
        setSaved(true);
        void queryClient.invalidateQueries({ queryKey: getGetAssistantBehaviorSettingsQueryKey() });
      },
      onError: () => setSaveFailed(true),
    });
  });

  const isDirty = form.formState.isDirty;
  const updatedAt = settingsQuery.data?.updatedAt
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(settingsQuery.data.updatedAt))
    : null;

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

        <aside className="admin-access-warning" role="note" data-testid="notice-admin-access">
          <div className="admin-warning-icon"><AlertTriangle size={17} /></div>
          <div>
            <strong>This page has no login.</strong>
            <p>Anyone who visits <code>/admin</code> can change the assistant’s public settings. Keep this page private or restrict access at the hosting level.</p>
          </div>
          <span className="warning-flag">Access note</span>
        </aside>

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
                <div className="admin-range-note"><span>Both scales run from 0 to 10.</span><span>Settings guide behavior; product recommendations remain grounded in the catalog.</span></div>
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

        <footer className="admin-footer"><span>Thoughtful tech. Clear answers.</span><span>Assistant controls <i>·</i> Circuit House</span></footer>
      </main>
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
