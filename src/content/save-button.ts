const BUTTON_SIZE = 34;
const BUTTON_MARGIN = 8;

type SaveButtonState = "idle" | "saving" | "saved" | "skipped" | "failed";

export type SaveButton = {
  element: HTMLButtonElement;
  hide: () => void;
  setState: (state: SaveButtonState) => void;
  showForViewportRect: (rect: DOMRect) => void;
};

export function createSaveButton(): SaveButton {
  const host = document.createElement("div");
  host.id = "x-media-downloader-root";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483647;
        pointer-events: none;
      }

      button {
        position: absolute;
        width: ${BUTTON_SIZE}px;
        height: ${BUTTON_SIZE}px;
        display: none;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.9);
        color: white;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
        cursor: pointer;
        pointer-events: auto;
        font: 700 18px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button[data-state="saving"] {
        background: rgba(37, 99, 235, 0.94);
      }

      button[data-state="saved"] {
        background: rgba(22, 163, 74, 0.94);
      }

      button[data-state="skipped"] {
        background: rgba(100, 116, 139, 0.94);
      }

      button[data-state="failed"] {
        background: rgba(220, 38, 38, 0.94);
      }

      button:hover {
        background: rgba(2, 6, 23, 0.96);
      }

      button[data-state="saving"]:hover {
        background: rgba(29, 78, 216, 0.96);
      }

      button[data-state="saved"]:hover {
        background: rgba(21, 128, 61, 0.96);
      }

      button[data-state="skipped"]:hover {
        background: rgba(71, 85, 105, 0.96);
      }

      button[data-state="failed"]:hover {
        background: rgba(185, 28, 28, 0.96);
      }

      button:disabled {
        cursor: progress;
        opacity: 0.86;
      }
    </style>
    <button type="button" title="Save media" aria-label="Save media">↓</button>
  `;

  const button = shadow.querySelector("button");

  if (!button) {
    throw new Error("Failed to create save button.");
  }

  return {
    element: button,
    hide: () => {
      button.style.display = "none";
    },
    setState: (state) => {
      setButtonState(button, state);
    },
    showForViewportRect: (rect) => {
      const viewportTop = Math.max(BUTTON_MARGIN, rect.top + BUTTON_MARGIN);
      const viewportLeft = Math.min(
        window.innerWidth - BUTTON_SIZE - BUTTON_MARGIN,
        rect.right - BUTTON_SIZE - BUTTON_MARGIN,
      );

      button.style.top = `${window.scrollY + viewportTop}px`;
      button.style.left = `${window.scrollX + Math.max(BUTTON_MARGIN, viewportLeft)}px`;
      button.style.display = "flex";
    },
  };
}

function setButtonState(button: HTMLButtonElement, state: SaveButtonState): void {
  button.disabled = state === "saving";
  button.dataset.state = state;

  if (state === "idle") {
    button.textContent = "↓";
    return;
  }

  if (state === "saving") {
    button.textContent = "...";
    return;
  }

  if (state === "saved") {
    button.textContent = "✓";
  } else if (state === "skipped") {
    button.textContent = "-";
  } else {
    button.textContent = "!";
  }
}
