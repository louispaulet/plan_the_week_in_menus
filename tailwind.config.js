/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        leaf: {
          50: "#f2f8f3",
          500: "#4f8a57",
          700: "#2f6238",
        },
        tomato: {
          50: "#fff2ee",
          500: "#e15c3b",
          700: "#a93721",
        },
        grain: {
          50: "#faf7ef",
          200: "#e8dcc5",
        },
        ink: {
          900: "#1f2933",
          600: "#52606d",
        },
      },
      boxShadow: {
        panel: "0 16px 40px rgb(31 41 51 / 0.08)",
      },
    },
  },
  plugins: [],
};
