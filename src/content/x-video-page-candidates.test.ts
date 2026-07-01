import { describe, expect, test } from "vitest";

import {
  createXVideoPageCandidateStore,
  parseXVideoPageCandidateMessage,
} from "./x-video-page-candidates";

const videoUrl =
  "https://video.twimg.com/amplify_video/2072046031202562048/vid/avc1/1022x566/high.mp4?tag=28";
const posterUrl = "https://pbs.twimg.com/amplify_video_thumb/2072046031202562048/img/thumb.jpg";

describe("parseXVideoPageCandidateMessage", () => {
  test("normalizes valid page messages", () => {
    expect(
      parseXVideoPageCandidateMessage({
        source: "x-media-downloader-page",
        type: "X_VIDEO_API_CANDIDATES",
        delivery: "live",
        requestPath: "x.com/i/api/graphql/HomeTimeline",
        candidates: [
          {
            tweetId: "2072068448268775859",
            mediaId: "2072046031202562048",
            videoUrl,
            mediaType: "video",
            bitrate: 2176000,
          },
        ],
      }),
    ).toEqual({
      delivery: "live",
      requestPath: "x.com/i/api/graphql/HomeTimeline",
      candidates: [
        {
          tweetId: "2072068448268775859",
          mediaId: "2072046031202562048",
          videoUrl,
          mediaType: "video",
          bitrate: 2176000,
        },
      ],
    });
  });

  test("rejects malformed or forged page messages", () => {
    expect(parseXVideoPageCandidateMessage({})).toBeNull();
    expect(
      parseXVideoPageCandidateMessage({
        source: "x-media-downloader-page",
        type: "X_VIDEO_API_CANDIDATES",
        delivery: "live",
        candidates: [
          {
            mediaId: "2072046031202562048",
            videoUrl: "https://example.com/video.mp4",
            mediaType: "video",
          },
        ],
      }),
    ).toBeNull();
  });
});

describe("createXVideoPageCandidateStore", () => {
  test("resolves candidates by tweet and media id", () => {
    const store = createXVideoPageCandidateStore();
    const video = { poster: posterUrl } as HTMLVideoElement;

    store.cache([
      {
        tweetId: "2072068448268775859",
        mediaId: "2072046031202562048",
        videoUrl,
        mediaType: "video",
      },
    ]);

    expect(store.find(video, { tweetId: "2072068448268775859" })).toEqual({
      tweetId: "2072068448268775859",
      mediaId: "2072046031202562048",
      videoUrl,
      mediaType: "video",
    });
  });

  test("resolves a single tweet candidate when the hovered video poster has no media id", () => {
    const store = createXVideoPageCandidateStore();
    const video = {
      currentSrc: "blob:https://x.com/video",
      poster: "https://pbs.twimg.com/media/HMKoSbnXEAERYLR.jpg",
    } as HTMLVideoElement;

    store.cache([
      {
        tweetId: "2072402636813607381",
        mediaId: "2072401478288101376",
        videoUrl,
        mediaType: "video",
      },
    ]);

    expect(store.find(video, { tweetId: "2072402636813607381" })).toEqual({
      tweetId: "2072402636813607381",
      mediaId: "2072401478288101376",
      videoUrl,
      mediaType: "video",
    });
  });

  test("does not resolve by tweet when multiple candidates could match", () => {
    const store = createXVideoPageCandidateStore({
      getPageUrl: () => "https://x.com/claudeai/status/2072402636813607381",
    });
    const video = {
      currentSrc: "blob:https://x.com/video",
      poster: "https://pbs.twimg.com/media/HMKoSbnXEAERYLR.jpg",
    } as HTMLVideoElement;

    store.cache([
      {
        tweetId: "2072402636813607381",
        mediaId: "2072401478288101376",
        videoUrl,
        mediaType: "video",
      },
      {
        tweetId: "2072402636813607381",
        mediaId: "2072401478288101377",
        videoUrl:
          "https://video.twimg.com/amplify_video/2072401478288101377/vid/avc1/1022x566/high.mp4",
        mediaType: "video",
      },
    ]);

    expect(store.find(video, { tweetId: "2072402636813607381" })).toBeNull();
    expect(store.markMissing(video, { tweetId: "2072402636813607381" })).toMatchObject({
      reason: "ambiguous-tweet-candidates",
      tweetId: "2072402636813607381",
      mediaId: null,
    });
  });

  test("does not resolve media tab previews by tweet alone", () => {
    const store = createXVideoPageCandidateStore();

    store.cache([
      {
        tweetId: "2072402636813607381",
        mediaId: "2072401478288101376",
        videoUrl,
        mediaType: "video",
      },
    ]);

    expect(store.findByTweetAndPoster({ tweetId: "2072402636813607381" })).toBeNull();
  });

  test("does not resolve by tweet when a media tab preview has multiple candidates", () => {
    const store = createXVideoPageCandidateStore();

    store.cache([
      {
        tweetId: "2072402636813607381",
        mediaId: "2072401478288101376",
        videoUrl,
        mediaType: "video",
      },
      {
        tweetId: "2072402636813607381",
        mediaId: "2072401478288101377",
        videoUrl:
          "https://video.twimg.com/amplify_video/2072401478288101377/vid/avc1/1022x566/high.mp4",
        mediaType: "video",
      },
    ]);

    expect(store.findByTweetAndPoster({ tweetId: "2072402636813607381" })).toBeNull();
  });

  test("resolves a media tab preview by matching its poster URL", () => {
    const store = createXVideoPageCandidateStore();

    store.cache([
      {
        tweetId: "2072402636813607381",
        mediaId: "2072401478288101376",
        videoUrl,
        mediaType: "video",
        posterUrl: "https://pbs.twimg.com/media/HMKoSbnXEAERYLR.jpg",
      },
      {
        tweetId: "2072402636813607381",
        mediaId: "2072401478288101377",
        videoUrl:
          "https://video.twimg.com/amplify_video/2072401478288101377/vid/avc1/1022x566/high.mp4",
        mediaType: "video",
        posterUrl: "https://pbs.twimg.com/media/HMKoSbnXEAERYLS.jpg",
      },
    ]);

    expect(
      store.findByTweetAndPoster(
        { tweetId: "2072402636813607381" },
        "https://pbs.twimg.com/media/HMKoSbnXEAERYLR.jpg?format=jpg&name=small",
      ),
    ).toEqual({
      tweetId: "2072402636813607381",
      mediaId: "2072401478288101376",
      videoUrl,
      mediaType: "video",
      posterUrl: "https://pbs.twimg.com/media/HMKoSbnXEAERYLR.jpg",
    });
  });

  test("matches media tab poster URLs across X image URL extension variants", () => {
    const store = createXVideoPageCandidateStore();

    store.cache([
      {
        tweetId: "2072416723425513697",
        mediaId: "2072416673358118912",
        videoUrl:
          "https://video.twimg.com/amplify_video/2072416673358118912/vid/avc1/1280x720/gSbmzuNlkLpcVc1q.mp4?tag=14",
        mediaType: "video",
        posterUrl:
          "https://pbs.twimg.com/amplify_video_thumb/2072416673358118912/img/3P4FxqLn6YOjDOAJ.jpg",
      },
    ]);

    expect(
      store.findByTweetAndPoster(
        { tweetId: "2072416723425513697" },
        "https://pbs.twimg.com/amplify_video_thumb/2072416673358118912/img/3P4FxqLn6YOjDOAJ?format=jpg&name=360x360",
      ),
    ).toMatchObject({
      tweetId: "2072416723425513697",
      mediaId: "2072416673358118912",
    });
  });

  test("emits a missing-candidate log once per media key", () => {
    const store = createXVideoPageCandidateStore({
      getPageUrl: () => "https://x.com/home",
    });
    const video = { poster: posterUrl } as HTMLVideoElement;

    expect(store.markMissing(video, { tweetId: "2072068448268775859" })).toEqual({
      reason: "missing-candidate",
      tweetId: "2072068448268775859",
      mediaId: "2072046031202562048",
      posterUrl,
      pageUrl: "https://x.com/home",
    });
    expect(store.markMissing(video, { tweetId: "2072068448268775859" })).toBeNull();
  });

  test("emits a missing-media-id log once when a hovered video has no recognizable poster", () => {
    const store = createXVideoPageCandidateStore({
      getPageUrl: () => "https://x.com/claudeai/status/2072402636813607381",
    });
    const video = {
      currentSrc: "blob:https://x.com/video",
      poster: "https://pbs.twimg.com/card_img/example.jpg",
      src: "",
    } as HTMLVideoElement;

    expect(store.markMissing(video, { tweetId: "2072402636813607381" })).toEqual({
      reason: "missing-media-id",
      tweetId: "2072402636813607381",
      mediaId: null,
      posterUrl: "https://pbs.twimg.com/card_img/example.jpg",
      videoSrc: "blob:https://x.com/video",
      pageUrl: "https://x.com/claudeai/status/2072402636813607381",
    });
    expect(store.markMissing(video, { tweetId: "2072402636813607381" })).toBeNull();
  });
});
