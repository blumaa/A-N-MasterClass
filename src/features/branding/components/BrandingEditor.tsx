'use client';
// Brand colours (+ fonts for a space) with a live preview and the contrast proof.
// The same check runs again in the DAL on save; here it only gives instant feedback.
import { useActionState, useState, type CSSProperties } from 'react';
import { Button, Card, CardBody, Field, Heading, Input, Select, Stack, Text } from '@/components/ui/mds';
import { FONT_IDS, fontLabel, fontStack, type FontId } from '@/lib/fonts/catalog';
import { BRAND_INPUTS, type BrandInput } from '@/tokens/brandInputs';
import type { BrandColors } from '@/tokens/resolveBrand';
import type { BrandingState } from '../actions';
import { contrastFailures } from '../contrast';
import { colorField } from '../formInput';
import { previewVars } from '../preview';
import styles from './BrandingEditor.module.css';

const LABELS: Record<BrandInput, string> = {
  accent: 'Accent',
  'accent-soft': 'Accent fill',
  page: 'Page background',
  card: 'Cards',
  hairline: 'Borders',
  mid: 'Muted',
  ink: 'Text',
};

type Fonts = { heading: FontId | null; body: FontId | null };

type Props = {
  action: (prev: BrandingState, form: FormData) => Promise<BrandingState>;
  colors: BrandColors;
  /** Space branding edits fonts; a program override (productId) edits colours only. */
  fonts?: Fonts;
  productId?: string;
};

function FontSelect({ label, name, value, onChange }: { label: string; name: string; value: FontId | null; onChange: (v: FontId | null) => void }) {
  return (
    <Field label={label}>
      <Select name={name} value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as FontId | null)}>
        <option value="">Default</option>
        {FONT_IDS.map((id) => (
          <option key={id} value={id}>
            {fontLabel(id)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function BrandingEditor({ action, colors: initial, fonts: initialFonts, productId }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [colors, setColors] = useState(initial);
  const [fonts, setFonts] = useState(initialFonts);
  const failures = contrastFailures(colors);

  const preview = {
    ...previewVars(colors),
    ...(fonts?.heading ? { '--mds-font-display': fontStack(fonts.heading) } : {}),
    ...(fonts?.body ? { '--mds-font-body': fontStack(fonts.body) } : {}),
  } as CSSProperties;

  return (
    <div className={styles.layout}>
      <form action={formAction} className={styles.form}>
        {productId ? <input type="hidden" name="productId" value={productId} /> : null}
        <div className={styles.colors}>
          {BRAND_INPUTS.map((input) => (
            <Field key={input} label={LABELS[input]}>
              <Input
                type="color"
                name={colorField(input)}
                value={colors[input]}
                onChange={(e) => setColors((c) => ({ ...c, [input]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        {fonts ? (
          <div className={styles.colors}>
            <FontSelect label="Heading font" name="fontHeading" value={fonts.heading} onChange={(heading) => setFonts((f) => f && { ...f, heading })} />
            <FontSelect label="Body font" name="fontBody" value={fonts.body} onChange={(body) => setFonts((f) => f && { ...f, body })} />
          </div>
        ) : null}
        {failures.length ? (
          <div role="alert">
            <Text tone="danger" variant="note">
              Not enough contrast, so this cannot be saved yet:
            </Text>
            <ul className={styles.failures}>
              {failures.map((f) => (
                <li key={`${f.fg}|${f.bg}`}>
                  <Text as="span" variant="note">
                    {f.fg} on {f.bg}: {f.ratio.toFixed(2)}:1, needs {f.min}:1
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={styles.actions}>
          <Button type="submit" variant="primary" size="sm" loading={pending} disabled={failures.length > 0}>
            {productId ? 'Save program colours' : 'Save branding'}
          </Button>
          <Button type="submit" name="intent" value="reset" variant="ghost" size="sm" disabled={pending}>
            {productId ? 'Use space colours' : 'Reset to defaults'}
          </Button>
        </div>
        {state ? (
          <Text role="status" tone={state.saved ? 'secondary' : 'danger'} variant="note">
            {state.message}
          </Text>
        ) : null}
      </form>
      <div data-preview className={styles.preview} style={preview}>
        <Stack gap="base">
          <Text variant="meta" tone="muted">
            Preview
          </Text>
          <Heading level={2} variant="title">
            Welcome to the masterclass
          </Heading>
          <Text tone="secondary">Every lesson, at your own pace.</Text>
          <Card>
            <CardBody>
              <Stack gap="tight">
                <Text>Module 1 · Foundations</Text>
                <div>
                  <Button type="button" variant="primary" size="sm">
                    Continue
                  </Button>
                </div>
              </Stack>
            </CardBody>
          </Card>
        </Stack>
      </div>
    </div>
  );
}
