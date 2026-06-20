import "./options.css";

import { isLocalBuild } from "../shared/build-flags";
import { clearDebugLogs, readDebugLogs, sendDebugLog } from "../shared/debug-log";
import { getBrowserLanguage, getUiMessages, resolveLocale } from "../shared/locale";
import type { LanguageSetting, UiMessages } from "../shared/locale";
import { getSettings, normalizeSettings, saveSettings } from "../shared/settings";
import type { DuplicateBehavior, Settings } from "../shared/settings";
import {
  applyTranslations,
  chooseSaveFolder,
  clearSaveFolder,
  createInitialFolderStateMap,
  FOLDER_MEDIA_TYPES,
  getFolderCardElementMap,
  getFolderStateMap,
  renderFolderCards,
} from "../shared/settings-view";
import type { FolderStateMap } from "../shared/settings-view";

const language = getElement<HTMLSelectElement>("language");
const filenameTemplate = getElement<HTMLInputElement>("filenameTemplate");
const duplicateBehavior = getElement<HTMLSelectElement>("duplicateBehavior");
const preferOriginalImage = getElement<HTMLInputElement>("preferOriginalImage");
const saveStatus = getElement<HTMLParagraphElement>("saveStatus");
const developerDiagnostics = getElement<HTMLDetailsElement>("developerDiagnostics");
const refreshLogs = getElement<HTMLButtonElement>("refreshLogs");
const clearLogs = getElement<HTMLButtonElement>("clearLogs");
const debugLogs = getElement<HTMLPreElement>("debugLogs");

const folderElementMap = getFolderCardElementMap(document);

let settings: Settings = normalizeSettings({});
let folderStates: FolderStateMap = createInitialFolderStateMap();
let messages: UiMessages = getUiMessages("en");

void init();

language.addEventListener("change", () => {
  void updateSettings({
    language: language.value as LanguageSetting,
  });
});

for (const mediaType of FOLDER_MEDIA_TYPES) {
  folderElementMap[mediaType].action.addEventListener("click", async () => {
    void logOptions("info", "Choosing save folder.", { mediaType });
    const result = await chooseSaveFolder(mediaType);
    folderStates = { ...folderStates, [mediaType]: result.folderState };
    render();

    if (result.ok) {
      void logOptions("info", "Save folder selected.", { mediaType });
      setSaveStatus(messages.folderSaved);
      return;
    }

    if (result.reason === "cancelled") {
      void logOptions("info", "Folder selection cancelled.", { mediaType });
      setSaveStatus(messages.folderSelectionCancelled);
      return;
    }

    if (result.reason === "permission-not-granted") {
      void logOptions("warn", "Save folder permission was not granted.", { mediaType });
      setSaveStatus(messages.folderPermissionNotGranted);
      return;
    }

    if (result.reason === "failed") {
      void logOptions("error", "Folder selection failed.", { mediaType, error: result.error });
      setSaveStatus(getErrorMessage(result.error));
    }
  });

  folderElementMap[mediaType].clear.addEventListener("click", async () => {
    const nextFolderState = await clearSaveFolder(mediaType);
    folderStates = { ...folderStates, [mediaType]: nextFolderState };
    render();
    void logOptions("info", "Save folder cleared.", { mediaType });
    setSaveStatus(messages.folderCleared);
  });
}

filenameTemplate.addEventListener("input", () => {
  void updateSettings({
    filenameTemplate: filenameTemplate.value,
  });
});

duplicateBehavior.addEventListener("change", () => {
  void updateSettings({
    duplicateBehavior: duplicateBehavior.value as DuplicateBehavior,
  });
});

preferOriginalImage.addEventListener("change", () => {
  void updateSettings({
    preferOriginalImage: preferOriginalImage.checked,
  });
});

if (isLocalBuild) {
  developerDiagnostics.hidden = false;

  refreshLogs.addEventListener("click", () => {
    void renderDebugLogs();
  });

  clearLogs.addEventListener("click", async () => {
    await clearDebugLogs();
    await logOptions("info", "Debug logs cleared.");
    await renderDebugLogs();
  });
} else {
  developerDiagnostics.remove();
}

async function init(): Promise<void> {
  [settings, folderStates] = await Promise.all([getSettings(), getFolderStateMap()]);
  syncControls();
  render();
  if (isLocalBuild) {
    await renderDebugLogs();
  }
}

async function updateSettings(next: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...next };
  await saveSettings(next);
  syncControls();
  render();
  if (isLocalBuild && "language" in next) {
    await renderDebugLogs();
  }
  setSaveStatus(messages.settingsSaved);
}

function syncControls(): void {
  language.value = settings.language;
  filenameTemplate.value = settings.filenameTemplate;
  duplicateBehavior.value = settings.duplicateBehavior;
  preferOriginalImage.checked = settings.preferOriginalImage;
}

function render(): void {
  const locale = resolveLocale(settings.language, getBrowserLanguage());
  messages = getUiMessages(locale);
  document.documentElement.lang = locale;
  applyTranslations(document, messages);
  renderFolderCards(folderElementMap, folderStates, messages);
}

async function renderDebugLogs(): Promise<void> {
  const logs = await readDebugLogs();

  if (logs.length === 0) {
    debugLogs.textContent = messages.noLogs;
    return;
  }

  debugLogs.textContent = logs
    .map((log) => {
      const details = log.details ? ` ${log.details}` : "";
      return `${log.timestamp} ${log.level.toUpperCase()} [${log.source}] ${log.message}${details}`;
    })
    .join("\n");
  debugLogs.scrollTop = debugLogs.scrollHeight;
}

function setSaveStatus(message: string): void {
  saveStatus.textContent = message;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }

  return element as T;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function logOptions(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  details?: unknown,
): Promise<void> {
  await sendDebugLog("options", level, message, details);
}
