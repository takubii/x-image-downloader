export type MediaType = "image" | "video" | "gif";

export const DEFAULT_MEDIA_TYPE: MediaType = "image";

export function normalizeMediaType(value: unknown): MediaType {
  return value === "video" || value === "gif" || value === "image" ? value : DEFAULT_MEDIA_TYPE;
}
