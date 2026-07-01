type XVideoPageCandidate = {
  tweetId?: string;
  mediaId: string;
  videoUrl: string;
  mediaType: "video" | "gif";
  bitrate?: number;
};

type XVideoVariant = {
  url: string;
  bitrate?: number;
};

type XVideoCandidatesMessage = {
  source: "x-image-downloader-page";
  type: "X_VIDEO_API_CANDIDATES";
  delivery: "live" | "snapshot";
  requestPath?: string;
  candidates: XVideoPageCandidate[];
};

type XVideoCandidatesRequestMessage = {
  source: "x-image-downloader-content";
  type: "REQUEST_X_VIDEO_API_CANDIDATES";
};

const PAGE_MESSAGE_SOURCE = "x-image-downloader-page";
const CONTENT_MESSAGE_SOURCE = "x-image-downloader-content";
const MAX_CACHED_CANDIDATES = 500;
const OBSERVER_INSTALLED_KEY = Symbol.for("x-image-downloader.videoObserverInstalled");

const candidateCache = new Map<string, XVideoPageCandidate>();
const observerWindow = window as unknown as Window & { [key: symbol]: boolean | undefined };

if (!observerWindow[OBSERVER_INSTALLED_KEY]) {
  observerWindow[OBSERVER_INSTALLED_KEY] = true;
  installFetchObserver();
  installXhrObserver();
  installMessageObserver();
}

function installFetchObserver(): void {
  const originalFetch = window.fetch;

  window.fetch = async function observedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await originalFetch.apply(this, [input, init]);
    const requestUrl = getRequestUrl(input);

    if (requestUrl) {
      inspectFetchResponse(requestUrl, response);
    }

    return response;
  };
}

function installXhrObserver(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const requestUrlByXhr = new WeakMap<XMLHttpRequest, string>();

  XMLHttpRequest.prototype.open = function observedOpen(
    method: string,
    url: string | URL,
    ...rest: [boolean?, string?, string?]
  ): void {
    requestUrlByXhr.set(this, String(url));
    return Reflect.apply(originalOpen, this, [method, url, ...rest]) as void;
  };

  XMLHttpRequest.prototype.send = function observedSend(body?: Document | XMLHttpRequestBodyInit) {
    this.addEventListener("loadend", () => {
      const requestUrl = requestUrlByXhr.get(this);

      if (!requestUrl || !isCandidateApiUrl(requestUrl) || !isReadableXhrResponse(this)) {
        return;
      }

      inspectResponseText(requestUrl, this.responseText);
    });

    return originalSend.call(this, body);
  };
}

function installMessageObserver(): void {
  window.addEventListener("message", (event: MessageEvent<XVideoCandidatesRequestMessage>) => {
    if (event.source !== window || event.origin !== location.origin) {
      return;
    }

    if (
      !event.data ||
      event.data.source !== CONTENT_MESSAGE_SOURCE ||
      event.data.type !== "REQUEST_X_VIDEO_API_CANDIDATES"
    ) {
      return;
    }

    publishCandidates("snapshot", Array.from(candidateCache.values()));
  });
}

function inspectFetchResponse(requestUrl: string, response: Response): void {
  if (!isCandidateApiUrl(requestUrl) || !isJsonResponse(response)) {
    return;
  }

  void response
    .clone()
    .json()
    .then((json: unknown) => {
      publishCandidates("live", extractXVideoCandidatesFromApiJson(json), requestUrl);
    })
    .catch(() => {
      // Ignore non-JSON and transient clone failures; the page request must stay untouched.
    });
}

function inspectResponseText(requestUrl: string, responseText: string): void {
  if (!responseText.includes("video_info") && !responseText.includes("video.twimg.com")) {
    return;
  }

  try {
    const json = JSON.parse(stripJsonPrefix(responseText));
    publishCandidates("live", extractXVideoCandidatesFromApiJson(json), requestUrl);
  } catch {
    // Ignore non-JSON XHR payloads.
  }
}

function publishCandidates(
  delivery: XVideoCandidatesMessage["delivery"],
  candidates: readonly XVideoPageCandidate[],
  requestUrl?: string,
): void {
  if (candidates.length === 0) {
    return;
  }

  rememberCandidates(candidates);

  window.postMessage(
    {
      source: PAGE_MESSAGE_SOURCE,
      type: "X_VIDEO_API_CANDIDATES",
      delivery,
      requestPath: requestUrl ? getRequestPath(requestUrl) : undefined,
      candidates: [...candidates],
    } satisfies XVideoCandidatesMessage,
    location.origin,
  );
}

function rememberCandidates(candidates: readonly XVideoPageCandidate[]): void {
  for (const candidate of candidates) {
    const key = `${candidate.tweetId || ""}:${candidate.mediaId}:${candidate.videoUrl}`;

    if (candidateCache.has(key)) {
      candidateCache.delete(key);
    }

    candidateCache.set(key, candidate);
  }

  while (candidateCache.size > MAX_CACHED_CANDIDATES) {
    const oldestKey = candidateCache.keys().next().value as string | undefined;

    if (!oldestKey) {
      return;
    }

    candidateCache.delete(oldestKey);
  }
}

function getRequestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (input instanceof Request) {
    return input.url;
  }

  return null;
}

function isCandidateApiUrl(value: string): boolean {
  try {
    const url = new URL(value, location.href);

    if (!["x.com", "twitter.com", "api.x.com", "api.twitter.com"].includes(url.hostname)) {
      return false;
    }

    return (
      url.pathname.includes("/i/api/graphql/") ||
      url.pathname.includes("/graphql/") ||
      url.pathname.includes("/timeline")
    );
  } catch {
    return false;
  }
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") || contentType.includes("text/plain");
}

function isReadableXhrResponse(xhr: XMLHttpRequest): boolean {
  return (
    xhr.status >= 200 &&
    xhr.status < 300 &&
    (xhr.responseType === "" || xhr.responseType === "text")
  );
}

function getRequestPath(value: string): string | undefined {
  try {
    const url = new URL(value, location.href);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function stripJsonPrefix(value: string): string {
  return value.startsWith("for (;;);") ? value.slice("for (;;);".length) : value;
}

function extractXVideoCandidatesFromApiJson(value: unknown): XVideoPageCandidate[] {
  const candidates: XVideoPageCandidate[] = [];

  walkRecords(value, [], (record, ancestors) => {
    const variant = selectBestXVideoVariant(getMp4Variants(record.video_info));

    if (!variant) {
      return;
    }

    const mediaId = getMediaIdFromRecord(record);

    if (!mediaId) {
      return;
    }

    candidates.push({
      tweetId: findTweetId(ancestors),
      mediaId,
      videoUrl: variant.url,
      mediaType: detectXVideoMediaType({
        apiMediaType: getStringValue(record.type),
        videoUrl: variant.url,
      }),
      bitrate: variant.bitrate,
    });
  });

  return dedupeCandidates(candidates);
}

function getMp4Variants(videoInfo: unknown): XVideoVariant[] {
  if (!isRecord(videoInfo) || !Array.isArray(videoInfo.variants)) {
    return [];
  }

  return videoInfo.variants
    .map((variant) => parseMp4Variant(variant))
    .filter((variant): variant is XVideoVariant => Boolean(variant));
}

function parseMp4Variant(value: unknown): XVideoVariant | null {
  if (!isRecord(value) || value.content_type !== "video/mp4") {
    return null;
  }

  const url = getDirectXMp4Url(getStringValue(value.url) || "");

  if (!url) {
    return null;
  }

  return {
    url,
    bitrate: typeof value.bitrate === "number" ? value.bitrate : undefined,
  };
}

function getMediaIdFromRecord(record: Record<string, unknown>): string | null {
  const idString = getStringValue(record.id_str) || getStringValue(record.id);

  if (idString) {
    return idString;
  }

  const mediaKey = getStringValue(record.media_key);
  const mediaKeyId = mediaKey?.match(/^\d+_(.+)$/)?.[1];

  if (mediaKeyId) {
    return mediaKeyId;
  }

  const mediaUrl = getStringValue(record.media_url_https);

  if (mediaUrl) {
    return getXVideoMediaId(mediaUrl);
  }

  const variants = isRecord(record.video_info) ? record.video_info.variants : undefined;

  if (Array.isArray(variants)) {
    for (const variant of variants) {
      if (isRecord(variant)) {
        const mediaId = getXVideoMediaId(getStringValue(variant.url) || "");

        if (mediaId) {
          return mediaId;
        }
      }
    }
  }

  return null;
}

function findTweetId(ancestors: readonly Record<string, unknown>[]): string | undefined {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const tweetId = getTweetIdFromRecord(ancestors[index]);

    if (tweetId) {
      return tweetId;
    }
  }

  return undefined;
}

function getTweetIdFromRecord(record: Record<string, unknown>): string | undefined {
  const restId = getStringValue(record.rest_id);

  if (restId && isRecord(record.legacy)) {
    return restId;
  }

  const idString = getStringValue(record.id_str);

  if (
    idString &&
    (isRecord(record.entities) ||
      isRecord(record.extended_entities) ||
      typeof record.full_text === "string")
  ) {
    return idString;
  }

  return undefined;
}

function dedupeCandidates(candidates: readonly XVideoPageCandidate[]): XVideoPageCandidate[] {
  const deduped = new Map<string, XVideoPageCandidate>();

  for (const candidate of candidates) {
    deduped.set(`${candidate.tweetId || ""}:${candidate.mediaId}:${candidate.videoUrl}`, candidate);
  }

  return Array.from(deduped.values());
}

function walkRecords(
  value: unknown,
  ancestors: readonly Record<string, unknown>[],
  callback: (
    record: Record<string, unknown>,
    ancestors: readonly Record<string, unknown>[],
  ) => void,
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkRecords(item, ancestors, callback);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  callback(record, ancestors);

  for (const child of Object.values(record)) {
    walkRecords(child, [...ancestors, record], callback);
  }
}

function selectBestXVideoVariant(variants: readonly XVideoVariant[]): XVideoVariant | null {
  return (
    variants
      .filter((variant) => getDirectXMp4Url(variant.url))
      .toSorted((left, right) => (right.bitrate || 0) - (left.bitrate || 0))[0] || null
  );
}

function detectXVideoMediaType(input: {
  apiMediaType?: string;
  videoUrl: string;
}): "video" | "gif" {
  if (input.apiMediaType === "animated_gif") {
    return "gif";
  }

  if (input.apiMediaType === "video") {
    return "video";
  }

  return input.videoUrl.includes("/tweet_video/") ? "gif" : "video";
}

function getDirectXMp4Url(value: string): string | null {
  try {
    const url = new URL(value.replaceAll("\\/", "/").replaceAll("&amp;", "&"));

    if (url.hostname !== "video.twimg.com" || !url.pathname.endsWith(".mp4")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getXVideoMediaId(value: string): string | null {
  try {
    const url = new URL(value.replaceAll("\\/", "/").replaceAll("&amp;", "&"));

    if (url.hostname !== "video.twimg.com" && url.hostname !== "pbs.twimg.com") {
      return null;
    }

    return (
      url.pathname.match(
        /\/(?:ext_tw_video|amplify_video|tweet_video_thumb|ext_tw_video_thumb|amplify_video_thumb)\/([^/]+)/,
      )?.[1] ||
      url.pathname.match(/\/tweet_video\/([^/.]+)/)?.[1] ||
      null
    );
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
