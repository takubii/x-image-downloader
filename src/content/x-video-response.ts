import {
  detectXVideoMediaType,
  getDirectXMp4Url,
  getXVideoMediaId,
  selectBestXVideoVariant,
} from "./video-target";
import type { XVideoMediaType, XVideoVariant } from "./video-target";

export type XVideoPageCandidate = {
  tweetId?: string;
  mediaId: string;
  videoUrl: string;
  mediaType: XVideoMediaType;
  bitrate?: number;
};

const MAX_ID_LENGTH = 80;
const X_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function extractXVideoCandidatesFromApiJson(value: unknown): XVideoPageCandidate[] {
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

export function normalizeXVideoPageCandidate(value: unknown): XVideoPageCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const mediaId = getStringValue(value.mediaId);
  const videoUrl = getDirectXMp4Url(getStringValue(value.videoUrl) || "");
  const mediaType = value.mediaType;

  if (
    !mediaId ||
    !isValidXId(mediaId) ||
    !videoUrl ||
    getXVideoMediaId(videoUrl) !== mediaId ||
    (mediaType !== "video" && mediaType !== "gif")
  ) {
    return null;
  }

  const tweetId = getStringValue(value.tweetId);
  const bitrate = value.bitrate;

  if (tweetId && (!isValidXId(tweetId) || !/^\d+$/.test(tweetId))) {
    return null;
  }

  if (bitrate !== undefined && (typeof bitrate !== "number" || !Number.isFinite(bitrate))) {
    return null;
  }

  return {
    tweetId,
    mediaId,
    videoUrl,
    mediaType,
    bitrate,
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isValidXId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_ID_LENGTH && X_ID_PATTERN.test(value);
}
