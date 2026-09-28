/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--wc-bg)',
        foreground: 'var(--wc-fg)',
        card: { DEFAULT: 'var(--wc-surface)', foreground: 'var(--wc-fg)' },
        popover: { DEFAULT: 'var(--wc-surface)', foreground: 'var(--wc-fg)' },
        primary: { DEFAULT: 'var(--wc-maroon)', foreground: '#ffffff' },
        secondary: { DEFAULT: 'var(--wc-surface-2)', foreground: 'var(--wc-fg)' },
        muted: { DEFAULT: 'var(--wc-surface-2)', foreground: 'var(--wc-muted)' },
        accent: { DEFAULT: 'var(--wc-gold)', foreground: '#0a0a0a' },
        destructive: { DEFAULT: '#b91c1c', foreground: '#ffffff' },
        border: 'var(--wc-border)',
        input: 'var(--wc-border)',
        ring: 'var(--wc-maroon)',
        gold: 'var(--wc-gold)',
        maroon: 'var(--wc-maroon)',
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [],
}
