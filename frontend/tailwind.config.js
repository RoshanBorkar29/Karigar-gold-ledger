/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",
        sidebar: {
          DEFAULT: "var(--color-sidebar)",
          border: "var(--color-sidebar-border)",
        },
        input: {
          bg: "var(--color-input-bg)",
          border: "var(--color-input-border)",
        },
        result: {
          bg: "var(--color-result-bg)",
          border: "var(--color-result-border)",
        },
        bronze: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
        },
        table: {
          header: "var(--color-table-header)",
          hover: "var(--color-table-hover)",
        },
        status: {
          ok: "var(--color-ok)",
          "ok-tint": "var(--color-ok-tint)",
          review: "var(--color-review)",
          "review-tint": "var(--color-review-tint)",
          problem: "var(--color-problem)",
          "problem-tint": "var(--color-problem-tint)",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["14px", { lineHeight: "1.5" }],
        base: ["16px", { lineHeight: "1.5" }],
        xl: ["24px", { lineHeight: "1.3" }],
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "6px",
        lg: "6px",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
        16: "64px",
      },
    },
  },
  plugins: [],
};
