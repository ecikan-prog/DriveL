export type ColorScheme = "light" | "dark";

export const SchemeColors = {
  light: {
    primary: "#003366",
    secondary: "#5980E9",
    background: "#ffffff",
    surface: "#F0F4FF",
    foreground: "#0D1B2A",
    muted: "#6B7A99",
    border: "#D1DCF0",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  dark: {
    primary: "#5980E9",
    secondary: "#7B9EFF",
    background: "#0D1B2A",
    surface: "#1A2744",
    foreground: "#F0F4FF",
    muted: "#8A9BBF",
    border: "#2A3D5E",
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#F87171",
  },
} as const satisfies Record<ColorScheme, Record<string, string>>;
