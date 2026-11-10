'use client';
// Runtime theme sheet. Server-rendered, so the first paint is already branded.
// The ref toggles `media` because Next may keep a left route mounted but hidden
// (Activity, docs: guides/preserving-ui-state "Global styles"); a hidden program
// override must not keep theming the visible page.
export function ThemeStyle({ css }: { css: string }) {
  if (!css) return null;
  return (
    <style
      ref={(style) => {
        if (style) style.media = '';
        return () => {
          if (style) style.media = 'not all';
        };
      }}
    >
      {css}
    </style>
  );
}
