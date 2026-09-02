/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',
        secondary: '#7C3AED',
        accent: '#06B6D4',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        canvas: '#09090B',
        surface: '#111827',
        card: '#18181B',
        'card-hover': '#1F1F23',
        border: 'rgba(255,255,255,0.08)',
        'border-strong': 'rgba(255,255,255,0.14)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.04), 0 20px 80px rgba(99, 102, 241, 0.18)',
        'glow-sm': '0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(99, 102, 241, 0.12)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '80%': { transform: 'scale(1.8)', opacity: '0' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2.4s cubic-bezier(0.4,0,0.2,1) infinite',
        floatSlow: 'floatSlow 5s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
