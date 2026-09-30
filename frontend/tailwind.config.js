/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--wc-bg)',
        surface: 'var(--wc-surface)',
        'surface-2': 'var(--wc-surface-2)',
        foreground: 'var(--wc-fg)',
        muted: 'var(--wc-muted)',
        border: 'var(--wc-border)',
        maroon: 'var(--wc-maroon)',
        'maroon-dark': 'var(--wc-maroon-dark)',
        gold: 'var(--wc-gold)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
