// Program shell: applies the program's colour override (if any) over the space theme.
import { programTheme } from '@/features/branding/api/branding';
import { ThemeStyle } from '@/features/branding/components/ThemeStyle';
import { themeCss } from '@/features/branding/theme';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export default async function ProgramLayout({ children, params }: LayoutProps<'/[space]/programs/[program]'>) {
  const { space, program } = await params;
  const viewer = await currentViewer(space);
  const colors = viewer ? await programTheme(getRepo(), viewer.space.id, program) : null;
  return (
    <>
      <ThemeStyle css={themeCss({ colors, fontHeading: null, fontBody: null }, 'program')} />
      {children}
    </>
  );
}
