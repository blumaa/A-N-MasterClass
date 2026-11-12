// "Report" disclosure on a post, comment or chat line: optional reason, sent once (G15).
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { Field, Textarea } from '@/components/ui/mds';
import { REPORT_REASON_MAX } from '@/lib/data/limits';
import type { ReportTarget } from '@/lib/data/types';
import { reportAction } from '../reportActions';
import styles from './community.module.css';

export function ReportForm({ targetType, targetId }: { targetType: ReportTarget; targetId: string }) {
  return (
    <details className={styles.report}>
      <summary>Report</summary>
      <ActionForm action={reportAction} fields={{ op: 'report', targetType, targetId }} submit="Send report">
        <Field label="Reason (optional)">
          <Textarea name="reason" rows={2} maxLength={REPORT_REASON_MAX} />
        </Field>
      </ActionForm>
    </details>
  );
}
