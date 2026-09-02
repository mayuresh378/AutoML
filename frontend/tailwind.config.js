/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#6366f1',
        accent: '#8b5cf6',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        canvas: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        card: 'var(--color-elevated)',
        'card-hover': 'var(--color-surface-hover)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        sidebar: 'var(--color-sidebar)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        selected: 'var(--selected)',
        ring: 'var(--ring)',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        heading: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['Barlow', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '0.625rem',
        DEFAULT: '9999px',
        md: '0.875rem',
        lg: '1.25rem',
        xl: '1.5rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.3), 0 1px 2px -1px rgba(0,0,0,0.2)',
        'card-hover': '0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.2)',
        sidebar: '0 0 1px 0 rgba(255,255,255,0.05)',
        dropdown: '0 4px 16px rgba(0,0,0,0.4)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
