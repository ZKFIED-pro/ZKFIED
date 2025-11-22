/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'display': ['Space Grotesk', 'sans-serif'],
        'body': ['IBM Plex Sans', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      colors: {
        
        void: '#0a0a0a', 
        dark: '#111111', 
        surface: '#1a1a1a', 
        border: '#222222',
        hover: '#1f1f1f', 
        text: {
          primary: '#e0e0e0', 
          secondary: '#888888', 
          accent: '#666666', 
        },
        white: '#ffffff', 
      },
      fontSize: {
        'hero': ['3.5rem', '3.5rem'], 
        'display': ['2.25rem', '2.75rem'], 
        'section': ['1.75rem', '2.25rem'], 
        'card-title': ['1.25rem', '1.75rem'], 
        'body-large': ['1.125rem', '1.75rem'], 
        'caption': ['0.75rem', '1rem'], 
        'code': ['0.8125rem', '1.25rem'], 
      },
      fontWeight: {
        'hero': '800',
        'display': '700',
        'section': '600',
        'card': '600',
      },
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '80': '20rem',
        '96': '24rem',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'subtle-pulse': 'subtlePulse 2000ms ease-in-out infinite',
        'card-hover': 'cardHover 200ms ease-out',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      }
    },
  },
  plugins: [],
}