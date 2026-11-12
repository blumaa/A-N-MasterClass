import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VIEWER_ZONE_SCRIPT } from '@/lib/time/viewerZone';
import { ViewerZoneScript } from './ViewerZoneScript';

describe('ViewerZoneScript', () => {
  it('ships the zone script, inert when rendered in the browser (it only runs from server HTML)', () => {
    const { container } = render(<ViewerZoneScript />);
    const script = container.querySelector('script')!;
    expect(script.innerHTML).toBe(VIEWER_ZONE_SCRIPT);
    expect(script.type).toBe('text/plain');
  });
});
