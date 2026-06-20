import { describe, expect, test } from "vitest";

import { getUiMessages } from "./locale";
import { createInitialFolderStateMap, getFolderCardCopy } from "./settings-view";

describe("createInitialFolderStateMap", () => {
  test("starts every media folder as missing", () => {
    expect(createInitialFolderStateMap()).toEqual({
      image: { kind: "missing" },
      video: { kind: "missing" },
      gif: { kind: "missing" },
    });
  });
});

describe("getFolderCardCopy", () => {
  test("uses image-specific copy for image folders", () => {
    const messages = getUiMessages("en");

    expect(getFolderCardCopy(messages, "image")).toEqual({
      missingDescription: "Choose a folder before saving images.",
      readyDescription: "Images will be saved to this folder.",
      permissionDescription: "Choose the folder again to continue saving images.",
    });
  });

  test("uses video-specific copy for video folders", () => {
    const messages = getUiMessages("en");

    expect(getFolderCardCopy(messages, "video")).toEqual({
      missingDescription: "Choose a folder before saving videos.",
      readyDescription: "Videos will be saved to this folder.",
      permissionDescription: "Choose the folder again to continue saving videos.",
    });
  });

  test("uses GIF-specific copy for GIF folders", () => {
    const messages = getUiMessages("en");

    expect(getFolderCardCopy(messages, "gif")).toEqual({
      missingDescription: "Choose a folder before saving GIFs.",
      readyDescription: "GIFs will be saved to this folder.",
      permissionDescription: "Choose the folder again to continue saving GIFs.",
    });
  });
});
