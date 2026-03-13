/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          black: "var(--c-bg-primary)",
          dark: "var(--c-bg-secondary)",
          muted: "var(--c-bg-tertiary)",
          border: "var(--c-border)",
          text: "var(--c-text-primary)",
          dim: "var(--c-text-secondary)",
          faded: "var(--c-text-tertiary)",
          green: "var(--c-accent-primary)",
          cyan: "var(--c-accent-secondary)",
          amber: "var(--c-accent-tertiary)",
          red: "var(--c-accent-danger)",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        body: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      animation: {
        "cursor-blink": "blink 1s step-end infinite",
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        typewriter: "typewriter 2s steps(20) forwards",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0 },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: "translateY(20px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px var(--c-accent-primary-glow)" },
          "50%": { boxShadow: "0 0 40px var(--c-accent-primary-glow)" },
        },
        typewriter: {
          from: { width: "0" },
          to: { width: "100%" },
        },
      },
    },
  },
  plugins: [],
};
