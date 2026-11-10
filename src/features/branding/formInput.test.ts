import { describe, expect, it } from 'vitest';
import { BRAND_INPUTS } from '@/tokens/brandInputs';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { brandingFromForm, colorField, colorsFromForm } from './formInput';

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}
const colorEntries = Object.fromEntries(BRAND_INPUTS.map((i) => [colorField(i), DEFAULT_BRAND[i]]));

describe('colorsFromForm', () => {
  it('reads the seven colour fields', () => {
    expect(colorsFromForm(form(colorEntries))).toEqual(DEFAULT_BRAND);
  });
  it('is null (= use defaults) when the reset button submitted', () => {
    expect(colorsFromForm(form({ ...colorEntries, intent: 'reset' }))).toBeNull();
  });
  it('passes raw values through for the DAL to validate', () => {
    expect(colorsFromForm(form({ ...colorEntries, [colorField('ink')]: 'red' }))).toMatchObject({ ink: 'red' });
  });
});

describe('brandingFromForm', () => {
  it('maps empty font selects to null (= default font)', () => {
    expect(brandingFromForm(form({ ...colorEntries, fontHeading: 'lora', fontBody: '' }))).toEqual({
      colors: DEFAULT_BRAND,
      fontHeading: 'lora',
      fontBody: null,
    });
  });
});
