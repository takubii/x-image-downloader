import { describe, expect, test } from "vitest";

import { isMediaTabPath } from "./media-preview-target";

describe("isMediaTabPath", () => {
  test("matches X profile media tab paths", () => {
    expect(isMediaTabPath("/v0/media")).toBe(true);
    expect(isMediaTabPath("/v0/media/")).toBe(true);
  });

  test("rejects non-media-tab paths", () => {
    expect(isMediaTabPath("/v0/status/2072416723425513697")).toBe(false);
    expect(isMediaTabPath("/home")).toBe(false);
  });
});
