import { describe, expect, test } from "vitest";

import { getImageKey } from "../shared/image-url";
import { getContentImageKey } from "./image-key";

describe("getContentImageKey", () => {
  test("normalizes X image size variants to the same key", () => {
    const small = "https://pbs.twimg.com/media/example?format=jpg&name=small";
    const original = "https://pbs.twimg.com/media/example?format=jpg&name=orig";

    expect(getContentImageKey(small)).toBe("https://pbs.twimg.com/media/example?format=jpg");
    expect(getContentImageKey(original)).toBe("https://pbs.twimg.com/media/example?format=jpg");
  });

  test("matches the shared image key normalization", () => {
    const imageUrl = "https://pbs.twimg.com/media/example?format=png&name=large";

    expect(getContentImageKey(imageUrl)).toBe(getImageKey(imageUrl));
  });
});
