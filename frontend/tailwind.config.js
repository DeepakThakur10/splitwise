/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.10)',
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px rgba(2, 6, 23, 0.28)'
      },
      backgroundImage: {
        'app-gradient': 'radial-gradient(circle at top left, rgba(14, 165, 233, 0.24), transparent 30%), radial-gradient(circle at top right, rgba(16, 185, 129, 0.18), transparent 28%), linear-gradient(180deg, #07111f 0%, #0f172a 55%, #111827 100%)'
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite'
      }
    }
  },
  plugins: []
};