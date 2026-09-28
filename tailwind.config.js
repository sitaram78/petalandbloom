/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Karla', 'sans-serif'],
      },
      colors: {
        linen: '#EFE8D8',
        canvas: '#E1D6BC',
        'canvas-line': '#CBBE9C',
        bark: {
          DEFAULT: '#2A241C',
          dark: '#1A1611',
        },
        rose: {
          DEFAULT: '#A8465A',
          deep: '#833549',
        },
        moss: {
          DEFAULT: '#58643F',
          soft: '#7C8B5C',
        },
        ink: {
          DEFAULT: '#2A241C',
          light: '#6B6250',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'fade-in-slow': 'fadeIn 1.5s ease-out forwards',
        'gentle-zoom': 'gentleZoom 8s ease-out forwards',
        'slide-in': 'slideIn 0.6s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        gentleZoom: {
          '0%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.rounded-atelier-btn': {
          'border-radius': '2px 14px 2px 14px',
        },
        '.rounded-atelier-img': {
          'border-radius': '2px 40px 2px 40px',
        },
        '.rounded-atelier-panel': {
          'border-radius': '2px 22px 2px 22px',
        },
      })
    },
  ],
};
