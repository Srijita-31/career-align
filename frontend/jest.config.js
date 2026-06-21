/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^lucide-react$": "<rootDir>/node_modules/lucide-react/dist/cjs/lucide-react.js",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json", jsx: "react-jsx" }],
  },
  transformIgnorePatterns: ["/node_modules/(?!lucide-react/)"],

  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
};
