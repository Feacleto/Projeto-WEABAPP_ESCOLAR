/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F8F7',
        card: '#FFFFFF',
        primary: '#1F5F3F',
        primaryDark: '#143F2A',
        secondary: '#F5A623',
        secondaryDark: '#D48816',
        accent: '#52C41A',
        accentDark: '#3F9B12',
        text: '#111827',
        textMuted: '#6B7280',
        success: '#52C41A',
        danger: '#EF4444',
        warning: '#F5A623',
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
