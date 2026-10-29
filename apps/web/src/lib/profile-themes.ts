export const PROFILE_THEMES = [
  { id: "classic", label: "Clásico", color: "#c8acf5" },
  { id: "ocean", label: "Azul", color: "#8acfe0" },
  { id: "rose", label: "Rosa", color: "#e9a8bd" },
  { id: "forest", label: "Verde", color: "#a3cf9d" },
] as const;
export type ProfileTheme = (typeof PROFILE_THEMES)[number]["id"];
export function profileTheme(value: unknown): ProfileTheme {
  return PROFILE_THEMES.some((theme) => theme.id === value)
    ? (value as ProfileTheme)
    : "classic";
}
