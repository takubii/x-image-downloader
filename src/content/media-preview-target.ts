import { isPointInsideRect } from "./image-visibility";

export function isMediaTabPath(pathname: string): boolean {
  return /^\/[^/]+\/media\/?$/.test(pathname);
}

export function findHoveredMediaPreviewElement(input: {
  target: Element;
  pointerX: number;
  pointerY: number;
  minSize: number;
}): Element | null {
  const root = input.target.closest<HTMLAnchorElement>('a[href*="/status/"]') || input.target;
  const candidates = [
    ...(input.target instanceof HTMLImageElement ? [input.target] : []),
    ...Array.from(root.querySelectorAll<HTMLImageElement>("img")),
    root,
  ];

  return (
    candidates.find((candidate) => {
      const rect = candidate.getBoundingClientRect();

      return (
        rect.width >= input.minSize &&
        rect.height >= input.minSize &&
        isPointInsideRect(input.pointerX, input.pointerY, rect)
      );
    }) || null
  );
}

export function getPreviewPosterUrl(preview: Element): string | undefined {
  if (preview instanceof HTMLImageElement) {
    return preview.currentSrc || preview.src || undefined;
  }

  return (
    Array.from(preview.querySelectorAll<HTMLImageElement>("img"))
      .map((image) => image.currentSrc || image.src)
      .find((url) => Boolean(url)) || undefined
  );
}
