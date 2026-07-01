import { describe, expect, test } from "vitest";

import { parseStatusInfo } from "./status-info";

describe("parseStatusInfo", () => {
  test("extracts author and tweet id from X status paths", () => {
    expect(parseStatusInfo("/claudeai/status/2072402636813607381")).toEqual({
      author: "claudeai",
      tweetId: "2072402636813607381",
    });
    expect(parseStatusInfo("https://x.com/v0/status/2072416723425513697/photo/1")).toEqual({
      author: "v0",
      tweetId: "2072416723425513697",
    });
  });

  test("returns null for non-status paths", () => {
    expect(parseStatusInfo("/v0/media")).toBeNull();
  });
});
