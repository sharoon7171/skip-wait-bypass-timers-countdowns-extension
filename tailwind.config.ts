import type { Config } from 'tailwindcss';
import type { PluginAPI } from 'tailwindcss/plugin';
import { accent, neutral, primary, success, warning } from './tokens/colors';
import { radius } from './tokens/radius';
import { spacingAliases } from './tokens/spacing';
import { fontFamilies } from './tokens/typography';

const poppinsStack = [...fontFamilies.poppins].join(', ');

export default {
  theme: {
    extend: {
      colors: {
        primary: { ...primary },
        accent: { ...accent },
        neutral: { ...neutral },
        warning: { ...warning },
        success: { ...success },
      },
      borderRadius: { ...radius },
      spacing: { ...spacingAliases },
      fontFamily: {
        poppins: [...fontFamilies.poppins],
        sans: [...fontFamilies.sans],
        mono: [...fontFamilies.mono],
      },
    },
  },
  plugins: [
    ({ addBase }: PluginAPI) => {
      addBase({
        'html, :host': { fontFamily: poppinsStack },
        'code, kbd, samp, pre': { fontFamily: poppinsStack },
      });
    },
  ],
} satisfies Config;
