import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [typography],
}

export default config
