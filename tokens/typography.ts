export const systemSans = [
  'Segoe UI Variable',
  'Segoe UI',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
] as const;

export const fontFamilies = {
  poppins: [...systemSans],
  sans: [...systemSans],
  mono: [...systemSans],
} as const;
