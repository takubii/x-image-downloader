import { clearDirectoryHandle, getDirectoryHandle, saveDirectoryHandle } from "./file-system-db";
import type { UiMessages } from "./locale";
import { DEFAULT_MEDIA_TYPE } from "./media-type";
import type { MediaType } from "./media-type";

export const FOLDER_MEDIA_TYPES: readonly MediaType[] = ["image", "video", "gif"];

export type FolderState =
  | { kind: "missing" }
  | { kind: "ready"; name: string }
  | { kind: "permission-required"; name: string };

export type FolderStateMap = Record<MediaType, FolderState>;

type FolderCardElements = {
  card: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  name: HTMLElement;
  action: HTMLButtonElement;
  clear: HTMLButtonElement;
};

type FolderCardCopy = {
  missingDescription: string;
  readyDescription: string;
  permissionDescription: string;
};

type FolderCardElementMap = Record<MediaType, FolderCardElements>;

export type ChooseFolderResult =
  | { ok: true; folderState: FolderState }
  | { ok: false; reason: "cancelled" | "permission-not-granted"; folderState: FolderState }
  | { ok: false; reason: "failed"; error: unknown; folderState: FolderState };

async function getFolderState(mediaType: MediaType = DEFAULT_MEDIA_TYPE): Promise<FolderState> {
  const directoryHandle = await getDirectoryHandle(mediaType);

  if (!directoryHandle) {
    return { kind: "missing" };
  }

  const permission = await directoryHandle.queryPermission({ mode: "readwrite" });

  if (permission === "granted") {
    return { kind: "ready", name: directoryHandle.name };
  }

  return { kind: "permission-required", name: directoryHandle.name };
}

export function createInitialFolderStateMap(): FolderStateMap {
  return {
    image: { kind: "missing" },
    video: { kind: "missing" },
    gif: { kind: "missing" },
  };
}

export async function getFolderStateMap(): Promise<FolderStateMap> {
  const [image, video, gif] = await Promise.all(
    FOLDER_MEDIA_TYPES.map((mediaType) => getFolderState(mediaType)),
  );

  return { image, video, gif };
}

export async function chooseSaveFolder(
  mediaType: MediaType = DEFAULT_MEDIA_TYPE,
): Promise<ChooseFolderResult> {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const permission = await handle.requestPermission({ mode: "readwrite" });

    if (permission !== "granted") {
      return {
        ok: false,
        reason: "permission-not-granted",
        folderState: await getFolderState(mediaType),
      };
    }

    await saveDirectoryHandle(handle, mediaType);

    return {
      ok: true,
      folderState: { kind: "ready", name: handle.name },
    };
  } catch (error) {
    const folderState = await getFolderState(mediaType);

    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, reason: "cancelled", folderState };
    }

    return { ok: false, reason: "failed", error, folderState };
  }
}

export async function clearSaveFolder(
  mediaType: MediaType = DEFAULT_MEDIA_TYPE,
): Promise<FolderState> {
  await clearDirectoryHandle(mediaType);
  return { kind: "missing" };
}

export function getFolderCardCopy(messages: UiMessages, mediaType: MediaType): FolderCardCopy {
  if (mediaType === "video") {
    return {
      missingDescription: messages.videoFolderNotSelectedDescription,
      readyDescription: messages.videoFolderReadyDescription,
      permissionDescription: messages.videoFolderPermissionDescription,
    };
  }

  if (mediaType === "gif") {
    return {
      missingDescription: messages.gifFolderNotSelectedDescription,
      readyDescription: messages.gifFolderReadyDescription,
      permissionDescription: messages.gifFolderPermissionDescription,
    };
  }

  return {
    missingDescription: messages.imageFolderNotSelectedDescription,
    readyDescription: messages.imageFolderReadyDescription,
    permissionDescription: messages.imageFolderPermissionDescription,
  };
}

export function applyTranslations(root: ParentNode, messages: UiMessages): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n as keyof UiMessages;
    element.textContent = messages[key];
  }
}

export function getFolderCardElementMap(root: ParentNode): FolderCardElementMap {
  return {
    image: getFolderCardElements(root, "image"),
    video: getFolderCardElements(root, "video"),
    gif: getFolderCardElements(root, "gif"),
  };
}

export function renderFolderCards(
  elementMap: FolderCardElementMap,
  stateMap: FolderStateMap,
  messages: UiMessages,
): void {
  for (const mediaType of FOLDER_MEDIA_TYPES) {
    renderFolderCard(
      elementMap[mediaType],
      stateMap[mediaType],
      messages,
      getFolderCardCopy(messages, mediaType),
    );
  }
}

function renderFolderCard(
  elements: FolderCardElements,
  folderState: FolderState,
  messages: UiMessages,
  copy: FolderCardCopy,
): void {
  elements.card.dataset.state = folderState.kind;

  if (folderState.kind === "missing") {
    elements.title.textContent = messages.folderNotSelectedTitle;
    elements.description.textContent = copy.missingDescription;
    elements.name.textContent = "";
    elements.name.parentElement?.setAttribute("hidden", "");
    elements.action.textContent = messages.chooseFolder;
    elements.clear.textContent = messages.clearFolder;
    elements.clear.hidden = true;
    elements.clear.disabled = true;
    return;
  }

  elements.name.textContent = folderState.name;
  elements.name.parentElement?.removeAttribute("hidden");
  elements.action.textContent = messages.chooseAgain;
  elements.clear.textContent = messages.clearFolder;
  elements.clear.hidden = false;
  elements.clear.disabled = false;

  if (folderState.kind === "ready") {
    elements.title.textContent = messages.folderReadyTitle;
    elements.description.textContent = copy.readyDescription;
    return;
  }

  elements.title.textContent = messages.folderPermissionTitle;
  elements.description.textContent = copy.permissionDescription;
}

function getFolderCardElements(root: ParentNode, mediaType: MediaType): FolderCardElements {
  const card = getRequiredElement<HTMLElement>(root, `[data-folder-card="${mediaType}"]`);

  return {
    card,
    title: getRequiredElement<HTMLElement>(card, '[data-folder-role="title"]'),
    description: getRequiredElement<HTMLElement>(card, '[data-folder-role="description"]'),
    name: getRequiredElement<HTMLElement>(card, '[data-folder-role="name"]'),
    action: getRequiredElement<HTMLButtonElement>(card, '[data-folder-role="choose"]'),
    clear: getRequiredElement<HTMLButtonElement>(card, '[data-folder-role="clear"]'),
  };
}

function getRequiredElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}
