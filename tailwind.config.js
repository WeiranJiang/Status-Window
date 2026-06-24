/** @type {import('tailwindcss').Config} */
export default {
  content: ["./popup.html", "./sidepanel.html", "./offscreen.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 18px 45px rgba(63, 74, 110, 0.12)",
        card: "0 10px 30px rgba(66, 72, 104, 0.1)",
      },
      fontFamily: {
        display: ["'Avenir Next'", "'Nunito'", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["'Nunito'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
