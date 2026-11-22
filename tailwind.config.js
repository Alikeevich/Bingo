/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Unbounded', 'system-ui', 'sans-serif'],
        sans: ['Onest', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#120A22',
          soft: '#1C1033',
          card: '#241541',
        },
        cream: '#FFF6EC',
        // Пульт ведущего: спокойный графит, цвет даёт только лайм-акцент и обложки треков
        pult: {
          deep: '#0f0f10',    // сайдбар
          bg: '#141415',      // фон страницы
          card: '#19191b',    // карточки, панели
          raised: '#232325',  // поля, активная строка
          text: '#ededed',
          text2: '#a1a1a6',
          muted: '#85858b',
        },
        magenta: '#FF2D87',
        lime: '#C9FF3B',
        grape: '#7A3CFF',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'eq-bounce': {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '15%': { opacity: '1' },
          '100%': { transform: 'translateY(-130px)', opacity: '0' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.92) translateY(14px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        marquee: 'marquee 22s linear infinite',
        'marquee-fast': 'marquee 14s linear infinite',
        'pop-in': 'pop-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'spin-slow': 'spin-slow 14s linear infinite',
      },
    },
  },
  plugins: [],
};
