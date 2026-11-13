// Member's public certificate link (G26, Kajabi share URL). Off until they share; stopping kills
// the link, and sharing again makes a new one.
import { Field, Input, Stack, Text } from '@/components/ui/mds';
import { ShareCertificateForm } from './forms';

type Props = { program: string; url: string | null };

export function CertificateShare({ program, url }: Props) {
  if (!url) {
    return (
      <Stack gap="tight">
        <Text tone="muted" variant="note">
          Share a public page of your certificate. It shows your display name, the program and the date.
        </Text>
        <ShareCertificateForm fields={{ program, shared: 'true' }} submit="Share certificate" done="Share link on" inline />
      </Stack>
    );
  }
  return (
    <Stack gap="tight">
      <Field label="Public certificate link">
        <Input readOnly value={url} />
      </Field>
      <Text tone="muted" variant="note">
        Anyone with this link can see your certificate.
      </Text>
      <ShareCertificateForm
        fields={{ program, shared: 'false' }}
        submit="Stop sharing"
        done="Share link off"
        confirm="The link stops working for everyone who has it. Stop sharing?"
        inline
      />
    </Stack>
  );
}
