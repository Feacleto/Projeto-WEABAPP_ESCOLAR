/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F3F4F6',
        card: '#FFFFFF',
        primary: '#38BDF8',
        primaryDark: '#0284C7',
        text: '#111827',
        textMuted: '#6B7280',
        success: '#10B981',
        danger: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        mobile: '480px',
      },
    },
  },
  plugins: [],
};
