// FormData -> DAL input. Shape only; the DAL validates hex, fonts and contrast.
import { BRAND_INPUTS, type BrandInput } from '@/tokens/brandInputs';

export const colorField = (input: BrandInput) => `color.${input}`;

const text = (form: FormData, name: string): string => {
  const v = form.get(name);
  return typeof v === 'string' ? v : '';
};

/** null = back to defaults (reset button: name="intent" value="reset"). */
export function colorsFromForm(form: FormData): Record<string, string> | null {
  if (text(form, 'intent') === 'reset') return null;
  return Object.fromEntries(BRAND_INPUTS.map((i) => [i, text(form, colorField(i))]));
}

export function brandingFromForm(form: FormData) {
  return {
    colors: colorsFromForm(form),
    fontHeading: text(form, 'fontHeading') || null,
    fontBody: text(form, 'fontBody') || null,
  };
}

const pathOrNull = (form: FormData, name: string) => text(form, name) || null;

export const marksFromForm = (form: FormData) => ({
  logoPath: pathOrNull(form, 'logoPath'),
  faviconPath: pathOrNull(form, 'faviconPath'),
});
