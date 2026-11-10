// Dev-only profile switcher. Each row posts one profile id.
import { Badge, Button, Card, CardBody, Stack, Text } from '@/components/ui/mds';
import { devSignInAction } from '../actions';
import type { DevProfile } from '../api/devProfiles';
import styles from './DevLoginList.module.css';

export function DevLoginList({ profiles }: { profiles: DevProfile[] }) {
  return (
    <Stack gap="base" as="ul" className={styles.list}>
      {profiles.map((p) => (
        <li key={p.id}>
          <Card>
            <CardBody>
              <form action={devSignInAction} className={styles.row}>
                <input type="hidden" name="profileId" value={p.id} />
                <Stack gap="hairline" className={styles.who}>
                  <Text>{p.displayName}</Text>
                  <Text variant="meta" tone="muted">
                    {p.email}
                  </Text>
                </Stack>
                <Badge tone={p.role ? 'accent' : 'neutral'}>{p.role ?? 'student'}</Badge>
                <Button type="submit" variant="secondary">
                  Sign in
                </Button>
              </form>
            </CardBody>
          </Card>
        </li>
      ))}
    </Stack>
  );
}
