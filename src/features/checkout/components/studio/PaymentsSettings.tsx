// Studio > Payments (G28): the space's own PayPal REST app, sandbox + live. Owner only.
// The secret is write-only: the form shows whether one is stored, never the value.
import { Badge, Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import { PAYMENT_ENVS, type PaymentEnv } from '@/lib/data/types';
import type { CredentialsView, PaymentsView } from '../../api/payments';
import { PaymentsForm } from './StudioForms';
import styles from './Studio.module.css';

const ENV_LABEL: Record<PaymentEnv, string> = { sandbox: 'Sandbox (test payments)', live: 'Live (real payments)' };

function EnvForm({ env, creds, active }: { env: PaymentEnv; creds: CredentialsView | null; active: boolean }) {
  return (
    <section aria-label={ENV_LABEL[env]}>
      <Stack gap="base">
        <div className={styles.actions}>
          <Heading level={2} variant="subtitle">
            {ENV_LABEL[env]}
          </Heading>
          {active ? <Badge tone="success">In use</Badge> : null}
        </div>
        <PaymentsForm fields={{ env }} submit="Save">
          <Field label="Client ID">
            <Input name="clientId" required defaultValue={creds?.clientId ?? ''} autoComplete="off" />
          </Field>
          <Field label="Secret" hint={creds?.hasSecret ? 'A secret is stored. Leave blank to keep it.' : undefined}>
            <Input name="secret" type="password" required={!creds?.hasSecret} autoComplete="off" />
          </Field>
          <Field label="Webhook ID" hint="From the webhook you add in the PayPal app.">
            <Input name="webhookId" defaultValue={creds?.webhookId ?? ''} autoComplete="off" />
          </Field>
        </PaymentsForm>
      </Stack>
    </section>
  );
}

export function PaymentsSettings({ view, activeEnv, webhookUrl }: { view: PaymentsView; activeEnv: PaymentEnv; webhookUrl: string }) {
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Heading level={2} variant="subtitle">
          Setup checklist
        </Heading>
        <ol>
          <li>Open developer.paypal.com with your PayPal Business account and create a REST app (one for Sandbox, one for Live).</li>
          <li>Copy the app&apos;s Client ID and Secret into the matching form below.</li>
          <li>
            In the app, add a webhook with this URL: <span className={styles.mono}>{webhookUrl}</span>. Pick the events{' '}
            <span className={styles.mono}>PAYMENT.CAPTURE.COMPLETED</span> and <span className={styles.mono}>PAYMENT.CAPTURE.REFUNDED</span>, then
            paste the webhook ID below.
          </li>
          <li>Test a purchase on the staging site with a sandbox buyer account before going live.</li>
        </ol>
        <Text variant="note">PayPal charges its fees to your own PayPal account. The platform takes no cut.</Text>
      </Stack>
      {PAYMENT_ENVS.map((env) => (
        <EnvForm key={env} env={env} creds={view[env]} active={env === activeEnv} />
      ))}
    </Stack>
  );
}
