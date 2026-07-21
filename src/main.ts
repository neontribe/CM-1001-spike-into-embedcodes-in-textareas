import type {EmbedCodeLocation} from './@types/types';
import {EmbedCodeUtils} from './utils.js';

function main(): void {
  const textarea = document.querySelector<HTMLTextAreaElement>("#editor");
  const embedFeedback = document.querySelector<HTMLPreElement>("#embedFeedback");
  const parsePerformance = document.querySelector<HTMLPreElement>("#parsePerformance");

  if (!textarea || !embedFeedback || !parsePerformance) {
    console.error("Required elements not found in the page.");
    return;
  }

  const embedCodeUtils = new EmbedCodeUtils();

  let lastKeyPressed: string = "(none)";
  let currentEmbedCodes: EmbedCodeLocation[] = [];

  // Track selection method
  let isMouseDown: boolean = false;
  let lastSelectionMethod: string = "unknown";
  let isShiftPressed: boolean = false;

  const checkAndUpdateCaretPosition = (source: string, method?: string): void => {
    const startTime = performance.now();
    currentEmbedCodes = embedCodeUtils.findEmbedCodes(textarea.value);
    const actionRequired = embedCodeUtils.isActionIsRequired(textarea, currentEmbedCodes);

    if (actionRequired == null) {
      embedFeedback.textContent = "No action required";
      return;
    }

    if (actionRequired.selection) {
      embedFeedback.textContent = "Selection required:\nSource: " + source +
          "\nMethod: " + method +
          "\nLast Key Pressed: " + lastKeyPressed;
      return;
    } else {
      if ((source === "Click") || (source === "keyup" && lastKeyPressed === "ArrowRight")) {
        const embedCodeLocation: EmbedCodeLocation = currentEmbedCodes[actionRequired.embedCodeIndex];
        textarea.focus();
        textarea.setSelectionRange(embedCodeLocation.endIndex, embedCodeLocation.endIndex);
        return;
      }
      else if (source === "keyup" && lastKeyPressed === "ArrowLeft") {
        const embedCodeLocation: EmbedCodeLocation = currentEmbedCodes[actionRequired.embedCodeIndex];
        textarea.focus();
        textarea.setSelectionRange(embedCodeLocation.startIndex, embedCodeLocation.startIndex);
        return;
      }
      else {
        embedFeedback.textContent = "Action required:\nSource: " + source +
            "\nMethod: " + method +
            "\nLast Key Pressed: " + lastKeyPressed;
      }
    }
    const endTime = performance.now();
    parsePerformance.textContent = `Checking ${currentEmbedCodes.length} codes took ${endTime - startTime} ms`;
  }

  // Track mouse down/up for drag detection
  textarea.addEventListener("mousedown", () => {
    isMouseDown = true;
    lastSelectionMethod = "mouse drag";
  });

  textarea.addEventListener("mouseup", () => {
    isMouseDown = false;
  });

  // Track shift key state globally
  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Shift") {
      isShiftPressed = true;
    }
  });

  document.addEventListener("keyup", (event: KeyboardEvent) => {
    if (event.key === "Shift") {
      isShiftPressed = false;
    }
  });

  // Mouse click: fires after the browser has already moved the caret,
  // so selectionStart/selectionEnd reflect the click position.
  textarea.addEventListener("click", () => {
    checkAndUpdateCaretPosition("Click");
  });

  // Track key pressed
  textarea.addEventListener("keydown", (event: KeyboardEvent) => {
    lastKeyPressed = event.key;
    
    // Detect shift + arrow keys for keyboard selection
    if (event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight" || 
                            event.key === "ArrowUp" || event.key === "ArrowDown" ||
                            event.key === "Home" || event.key === "End" ||
                            event.key === "PageUp" || event.key === "PageDown")) {
      lastSelectionMethod = "Shift + " + event.key;
    }
  });

  // Keyboard-driven cursor movement (arrow keys, home/end, typing, etc).
  textarea.addEventListener("keyup", (event: KeyboardEvent) => {
    const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
    let method = undefined;
    
    if (hasSelection && event.shiftKey) {
      method = lastSelectionMethod;
    }
    
    checkAndUpdateCaretPosition("Key", method);
  });

  // Catches selection changes not covered above (e.g. select-all via menu,
  // drag-selecting with the mouse).
  document.addEventListener("selectionchange", () => {
    if (document.activeElement !== textarea) return;
    
    const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
    let method = undefined;
    
    if (hasSelection) {
      if (isMouseDown) {
        method = "mouse drag";
      } else if (isShiftPressed) {
        method = lastSelectionMethod;
      }
    }
    
    checkAndUpdateCaretPosition("Selection", method);
  });

  textarea.addEventListener("focus", () => {
    checkAndUpdateCaretPosition("Focus");
  });

  // Detect text changes and find embed-codes-multiple events to catch all changes
  textarea.addEventListener("input", () => {
    checkAndUpdateCaretPosition("input");
  });

  textarea.addEventListener("change", () => {
    checkAndUpdateCaretPosition("Change event triggered");
  });

  textarea.addEventListener("keyup", () => {
    checkAndUpdateCaretPosition("keyup");
  });

  textarea.addEventListener("paste", () => {
    // Paste needs a small delay to get the updated value
    setTimeout(() => checkAndUpdateCaretPosition("paste"), 0);
  });

  // Initial scan on page load
  checkAndUpdateCaretPosition("Running initial embed code scan");
}

document.addEventListener("DOMContentLoaded", main);
