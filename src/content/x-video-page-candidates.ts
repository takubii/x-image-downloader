import { getXVideoMediaId } from "./video-target";
import { normalizeXVideoPageCandidate } from "./x-video-response";
import type { XVideoPageCandidate } from "./x-video-response";

export type XVideoStatusInfo = {
  author?: string;
  tweetId?: string;
};

export type XVideoPageCandidateMessage = {
  delivery: "live" | "snapshot";
  requestPath?: string;
  candidates: XVideoPageCandidate[];
};

type MissingXVideoCandidateLog = {
  reason: "missing-media-id" | "missing-candidate" | "ambiguous-tweet-candidates";
  tweetId?: string;
  mediaId: string | null;
  posterUrl?: string;
  videoSrc?: string;
  pageUrl: string;
};

type XVideoPageCandidateStore = {
  cache(candidates: readonly XVideoPageCandidate[]): void;
  find(video: HTMLVideoElement, statusInfo: XVideoStatusInfo): XVideoPageCandidate | null;
  findByTweetAndPoster(
    statusInfo: XVideoStatusInfo,
    posterUrl?: string,
  ): XVideoPageCandidate | null;
  markMissing(
    video: HTMLVideoElement,
    statusInfo: XVideoStatusInfo,
  ): MissingXVideoCandidateLog | null;
};

type XVideoPageCandidateStoreOptions = {
  getPageUrl?: () => string;
};

type XVideoCandidateIndex = {
  byMediaKey: Map<string, XVideoPageCandidate>;
  byPoster: Map<string, XVideoPageCandidate>;
  byTweet: Map<string, XVideoPageCandidate[]>;
};

const PAGE_MESSAGE_SOURCE = "x-media-downloader-page";
const PAGE_MESSAGE_TYPE = "X_VIDEO_API_CANDIDATES";
const CONTENT_MESSAGE_SOURCE = "x-media-downloader-content";
const SNAPSHOT_REQUEST_TYPE = "REQUEST_X_VIDEO_API_CANDIDATES";
const MAX_PAGE_VIDEO_CANDIDATE_CACHE_ENTRIES = 500;
const MAX_MISSING_VIDEO_LOG_ENTRIES = 500;

export function requestXVideoPageCandidateSnapshot(): void {
  window.postMessage(
    {
      source: CONTENT_MESSAGE_SOURCE,
      type: SNAPSHOT_REQUEST_TYPE,
    },
    location.origin,
  );
}

export function parseXVideoPageCandidateMessage(value: unknown): XVideoPageCandidateMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as {
    source?: unknown;
    type?: unknown;
    delivery?: unknown;
    requestPath?: unknown;
    candidates?: unknown;
  };

  if (
    message.source !== PAGE_MESSAGE_SOURCE ||
    message.type !== PAGE_MESSAGE_TYPE ||
    (message.delivery !== "live" && message.delivery !== "snapshot") ||
    !Array.isArray(message.candidates)
  ) {
    return null;
  }

  const candidates = message.candidates
    .map((candidate) => normalizeXVideoPageCandidate(candidate))
    .filter((candidate): candidate is XVideoPageCandidate => Boolean(candidate));

  if (candidates.length === 0) {
    return null;
  }

  return {
    delivery: message.delivery,
    requestPath: typeof message.requestPath === "string" ? message.requestPath : undefined,
    candidates,
  };
}

export function createXVideoPageCandidateStore(
  options: XVideoPageCandidateStoreOptions = {},
): XVideoPageCandidateStore {
  const index: XVideoCandidateIndex = {
    byMediaKey: new Map(),
    byPoster: new Map(),
    byTweet: new Map(),
  };
  const missingLogs = new Set<string>();
  const getPageUrl = options.getPageUrl || (() => location.href);

  return {
    cache(values) {
      for (const value of values) {
        cacheCandidate(index, value);
      }
    },

    find(video, statusInfo) {
      const mediaId = video.poster ? getXVideoMediaId(video.poster) : null;

      if (!mediaId && statusInfo.tweetId) {
        return findByTweetCandidate(index, statusInfo, video.poster);
      }

      for (const cacheKey of getVideoResolutionCacheKeys(mediaId, statusInfo)) {
        const candidate = index.byMediaKey.get(cacheKey);

        if (candidate) {
          return candidate;
        }
      }

      return null;
    },

    findByTweetAndPoster(statusInfo, posterUrl) {
      if (!statusInfo.tweetId || !posterUrl) {
        return null;
      }

      return findByPosterCandidate(index, statusInfo, posterUrl);
    },

    markMissing(video, statusInfo) {
      const mediaId = video.poster ? getXVideoMediaId(video.poster) : null;
      const tweetCandidateCount = statusInfo.tweetId
        ? index.byTweet.get(statusInfo.tweetId)?.length || 0
        : 0;
      const logKey = mediaId
        ? statusInfo.tweetId
          ? getTweetMediaCacheKey(statusInfo.tweetId, mediaId)
          : getMediaCacheKey(mediaId)
        : getMissingMediaIdLogKey(video, statusInfo);

      if (missingLogs.has(logKey)) {
        return null;
      }

      addBoundedSetValue(missingLogs, logKey, MAX_MISSING_VIDEO_LOG_ENTRIES);

      return {
        reason: getMissingCandidateReason(mediaId, tweetCandidateCount),
        tweetId: statusInfo.tweetId,
        mediaId,
        posterUrl: video.poster || undefined,
        videoSrc: video.currentSrc || video.src || undefined,
        pageUrl: getPageUrl(),
      };
    },
  };
}

function cacheCandidate(index: XVideoCandidateIndex, candidate: XVideoPageCandidate): void {
  setBoundedMapValue(
    index.byMediaKey,
    getMediaCacheKey(candidate.mediaId),
    candidate,
    MAX_PAGE_VIDEO_CANDIDATE_CACHE_ENTRIES,
  );

  if (candidate.tweetId) {
    setBoundedMapValue(
      index.byMediaKey,
      getTweetMediaCacheKey(candidate.tweetId, candidate.mediaId),
      candidate,
      MAX_PAGE_VIDEO_CANDIDATE_CACHE_ENTRIES,
    );
    appendTweetCandidate(index.byTweet, candidate);
  }

  if (candidate.posterUrl) {
    const posterKey = getPosterCacheKey(candidate.posterUrl);

    if (!posterKey) {
      return;
    }

    setBoundedMapValue(
      index.byPoster,
      posterKey,
      candidate,
      MAX_PAGE_VIDEO_CANDIDATE_CACHE_ENTRIES,
    );
  }
}

function getVideoResolutionCacheKeys(
  mediaId: string | null,
  statusInfo: XVideoStatusInfo,
): string[] {
  if (!mediaId) {
    return [];
  }

  return [
    ...(statusInfo.tweetId ? [getTweetMediaCacheKey(statusInfo.tweetId, mediaId)] : []),
    getMediaCacheKey(mediaId),
  ];
}

function getTweetMediaCacheKey(tweetId: string, mediaId: string): string {
  return `${tweetId}:${mediaId}`;
}

function getMediaCacheKey(mediaId: string): string {
  return `media:${mediaId}`;
}

function getPosterCacheKey(posterUrl: string): string | null {
  try {
    const url = new URL(posterUrl);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\.(?:jpe?g|png|webp)$/i, "");
    return url.toString();
  } catch {
    return null;
  }
}

function getMissingMediaIdLogKey(video: HTMLVideoElement, statusInfo: XVideoStatusInfo): string {
  return ["missing-media-id", statusInfo.tweetId || "", video.poster || ""].join(":");
}

function getMissingCandidateReason(
  mediaId: string | null,
  tweetCandidateCount: number,
): MissingXVideoCandidateLog["reason"] {
  if (mediaId) {
    return "missing-candidate";
  }

  return tweetCandidateCount > 1 ? "ambiguous-tweet-candidates" : "missing-media-id";
}

function appendTweetCandidate(
  tweetCandidates: Map<string, XVideoPageCandidate[]>,
  candidate: XVideoPageCandidate,
): void {
  if (!candidate.tweetId) {
    return;
  }

  const current = tweetCandidates.get(candidate.tweetId) || [];

  if (
    current.some(
      (value) => value.mediaId === candidate.mediaId && value.videoUrl === candidate.videoUrl,
    )
  ) {
    return;
  }

  setBoundedMapValue(
    tweetCandidates,
    candidate.tweetId,
    [...current, candidate],
    MAX_PAGE_VIDEO_CANDIDATE_CACHE_ENTRIES,
  );
}

function getSingleTweetCandidate(
  tweetCandidates: Map<string, XVideoPageCandidate[]>,
  tweetId: string,
): XVideoPageCandidate | null {
  const candidates = tweetCandidates.get(tweetId) || [];

  return candidates.length === 1 ? candidates[0] : null;
}

function findByTweetCandidate(
  index: XVideoCandidateIndex,
  statusInfo: XVideoStatusInfo,
  posterUrl?: string,
): XVideoPageCandidate | null {
  if (!statusInfo.tweetId) {
    return null;
  }

  if (posterUrl) {
    const posterKey = getPosterCacheKey(posterUrl);
    const candidate = posterKey ? index.byPoster.get(posterKey) : null;

    if (candidate?.tweetId === statusInfo.tweetId) {
      return candidate;
    }
  }

  return getSingleTweetCandidate(index.byTweet, statusInfo.tweetId);
}

function findByPosterCandidate(
  index: XVideoCandidateIndex,
  statusInfo: XVideoStatusInfo,
  posterUrl: string,
): XVideoPageCandidate | null {
  const posterKey = getPosterCacheKey(posterUrl);
  const candidate = posterKey ? index.byPoster.get(posterKey) : null;

  return candidate && candidate.tweetId === statusInfo.tweetId ? candidate : null;
}

function setBoundedMapValue<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  value: TValue,
  maxEntries: number,
): void {
  if (map.has(key)) {
    map.delete(key);
  }

  map.set(key, value);

  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value as TKey | undefined;

    if (oldestKey === undefined) {
      return;
    }

    map.delete(oldestKey);
  }
}

function addBoundedSetValue<TValue>(set: Set<TValue>, value: TValue, maxEntries: number): void {
  if (set.has(value)) {
    set.delete(value);
  }

  set.add(value);

  while (set.size > maxEntries) {
    const oldestValue = set.values().next().value as TValue | undefined;

    if (oldestValue === undefined) {
      return;
    }

    set.delete(oldestValue);
  }
}
