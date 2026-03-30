/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: process.env.DARK_MODE ? process.env.DARK_MODE : 'class',
  content: [
    './app/**/*.{html,js,jsx,ts,tsx,mdx}',
    './components/**/*.{html,js,jsx,ts,tsx,mdx}',
    './utils/**/*.{html,js,jsx,ts,tsx,mdx}',
    './*.{html,js,jsx,ts,tsx,mdx}',
    './src/**/*.{html,js,jsx,ts,tsx,mdx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        bgCard: '#12121A',
        bgElevated: '#1A1A26',
        bgModal: '#1E1E2E',
        primary: {
            DEFAULT: '#FA243C',
            light: '#FF3B50',
            dark: '#D6001B',
        },
        secondary: {
            DEFAULT: '#FA243C',
            light: '#FF3B50',
        },
        status: {
            nowPlaying: '#10B981',
            loved: '#EC4899',
            history: '#6366F1',
        },
        text: {
            primary: '#F1F5F9',
            secondary: '#94A3B8',
            muted: '#475569',
            inverse: '#0A0A0F',
        },
        border: '#1E1E2E',
        divider: '#1A1A26',
        overlay: 'rgba(0,0,0,0.7)',
        background: {
          light: '#FBFBFB',
          dark: '#181719',
        }
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
      },
      fontSize: {
        xs: '11px',
        sm: '13px',
        md: '15px',
        lg: '17px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
      },
      fontWeight: {
        thin: '200',
        light: '300',
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },
      fontFamily: {
        jakarta: ['var(--font-plus-jakarta-sans)', 'sans-serif'],
        roboto: ['var(--font-roboto)', 'sans-serif'],
        code: ['var(--font-source-code-pro)', 'monospace'],
        inter: ['var(--font-inter)', 'sans-serif'],
        'space-mono': ['var(--font-space-mono)', 'monospace'],
      },
      boxShadow: {
        'soft-1': '0px 0px 10px rgba(38, 38, 38, 0.1)',
        'soft-2': '0px 0px 20px rgba(38, 38, 38, 0.2)',
      },
    },
  },
};
