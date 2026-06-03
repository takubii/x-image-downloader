import { describe, expect, test } from "vitest";

import { createImageSaveStateStore } from "./save-state";

describe("createImageSaveStateStore", () => {
  test("returns idle for an image key without saved state", () => {
    const store = createImageSaveStateStore();

    expect(store.get("image-a")).toBe("idle");
    expect(store.isSaving("image-a")).toBe(false);
  });

  test("tracks save state independently per image key", () => {
    const store = createImageSaveStateStore();

    store.set("image-a", "saved");
    store.set("image-b", "failed");

    expect(store.get("image-a")).toBe("saved");
    expect(store.get("image-b")).toBe("failed");
  });

  test("detects duplicate clicks while the same image is saving", () => {
    const store = createImageSaveStateStore();

    store.set("image-a", "saving");

    expect(store.isSaving("image-a")).toBe(true);
    expect(store.isSaving("image-b")).toBe(false);
  });

  test("allows different images to save independently", () => {
    const store = createImageSaveStateStore();

    store.set("image-a", "saving");
    store.set("image-b", "saving");
    store.set("image-a", "saved");

    expect(store.get("image-a")).toBe("saved");
    expect(store.get("image-b")).toBe("saving");
  });

  test("clears saved state when an image returns to idle", () => {
    const store = createImageSaveStateStore();

    store.set("image-a", "failed");
    store.set("image-a", "idle");

    expect(store.get("image-a")).toBe("idle");
  });
});
