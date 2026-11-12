// Shared frame for sign-in, set-password and claim pages: one centred card, like Kajabi's login.
import type { ReactNode } from 'react';
import { Card, CardBody, Heading, Stack, Text } from '@/components/ui/mds';
import styles from './AuthPanel.module.css';

type Props = { title: string; intro?: ReactNode; children: ReactNode };

export function AuthPanel({ title, intro, children }: Props) {
  return (
    <div className={styles.frame}>
      <Card>
        <CardBody>
          <Stack gap="loose">
            <Stack gap="tight">
              <Heading level={1} variant="title">
                {title}
              </Heading>
              {intro ? <Text tone="secondary">{intro}</Text> : null}
            </Stack>
            {children}
          </Stack>
        </CardBody>
      </Card>
    </div>
  );
}
