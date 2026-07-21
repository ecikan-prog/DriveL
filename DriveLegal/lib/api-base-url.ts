export function getApiBaseUrl(): string {
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL?.trim();

  const baseUrl =
    configuredUrl ||
    "https://admin.drivelegal.app";

  return baseUrl
    .replace(/\/+$/, "")
    .replace(/\/admin$/, "");
}
