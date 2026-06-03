// Keep this content-local so the built content script stays a single non-module file.
export function getContentImageKey(imageUrl: string): string {
  const url = new URL(imageUrl);
  url.searchParams.delete("name");
  return url.toString();
}
