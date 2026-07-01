export type XStatusInfo = {
  author?: string;
  tweetId?: string;
};

export function findStatusInfo(element: Element, fallbackPath = location.pathname): XStatusInfo {
  const article = element.closest("article");
  const candidates = [
    element.closest<HTMLAnchorElement>('a[href*="/status/"]')?.getAttribute("href") || "",
    ...Array.from(
      (article || document).querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'),
    ).map((anchor) => anchor.getAttribute("href") || ""),
    fallbackPath,
  ];

  for (const candidate of candidates) {
    const statusInfo = parseStatusInfo(candidate);

    if (statusInfo) {
      return statusInfo;
    }
  }

  return {};
}

export function parseStatusInfo(value: string): XStatusInfo | null {
  const match = value.match(/\/([^/?#]+)\/status\/(\d+)/);

  if (!match) {
    return null;
  }

  return {
    author: match[1],
    tweetId: match[2],
  };
}
