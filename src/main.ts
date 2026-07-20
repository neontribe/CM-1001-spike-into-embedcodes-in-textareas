import embedRegex from './regex.js';

interface CaretInfo {
  index: number;
  line: number;
  column: number;
}

interface EmbedCodeLocation {
  embedCode: string;
  startIndex: number;
  endIndex: number;
}

interface EmbedCodeContext {
  isInEmbedCode: boolean;
  embedCodeIndex: number | null;
  embedCodeStartIndex: number | null;
  embedCodeEndIndex: number | null;
}

interface SelectionEmbedContext {
  hasEmbedCodes: boolean;
  embedCodesInSelection: EmbedCodeIntersection[];
  fullyContainedCount: number;
  partiallyContainedCount: number;
}

interface EmbedCodeIntersection {
  embedCodeIndex: number;
  embedCode: string;
  embedCodeStartIndex: number;
  embedCodeEndIndex: number;
  intersectionType: 'full' | 'partial-start' | 'partial-end' | 'partial-middle';
}

function getCaretInfo(textarea: HTMLTextAreaElement, index: number): CaretInfo {
  const before = textarea.value.slice(0, index);
  const lines = before.split("\n");
  const line = lines.length; // 1-based
  const column = lines[lines.length - 1].length + 1; // 1-based
  return { index, line, column };
}

function formatInfo(label: string, caret: CaretInfo): string {
  return `${label}: index=${caret.index}, line=${caret.line}, column=${caret.column}`;
}

function findEmbedCodes(text: string): EmbedCodeLocation[] {
  const locations: EmbedCodeLocation[] = [];
  const regex = new RegExp(embedRegex.source, 'g'); // Create a fresh regex to reset lastIndex

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    locations.push({
      embedCode: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  return locations;
}

function getEmbedCodeContext(caretIndex: number, embedCodes: EmbedCodeLocation[]): EmbedCodeContext {
  for (let i = 0; i < embedCodes.length; i++) {
    const embed = embedCodes[i];
    if (caretIndex >= embed.startIndex && caretIndex <= embed.endIndex) {
      return {
        isInEmbedCode: true,
        embedCodeIndex: i,
        embedCodeStartIndex: embed.startIndex,
        embedCodeEndIndex: embed.endIndex
      };
    }
  }

  return {
    isInEmbedCode: false,
    embedCodeIndex: null,
    embedCodeStartIndex: null,
    embedCodeEndIndex: null
  };
}

function getSelectionEmbedContext(selectionStart: number, selectionEnd: number, embedCodes: EmbedCodeLocation[]): SelectionEmbedContext {
  const embedCodesInSelection: EmbedCodeIntersection[] = [];
  let fullyContainedCount = 0;
  let partiallyContainedCount = 0;

  for (let i = 0; i < embedCodes.length; i++) {
    const embed = embedCodes[i];

    // Check if there's any overlap between selection and embed code
    // Overlap occurs if: selectionStart < embedEnd AND selectionEnd > embedStart
    if (selectionStart < embed.endIndex && selectionEnd > embed.startIndex) {
      let intersectionType: 'full' | 'partial-start' | 'partial-end' | 'partial-middle';

      // Fully contained: selection completely covers the embed code
      if (selectionStart <= embed.startIndex && selectionEnd >= embed.endIndex) {
        intersectionType = 'full';
        fullyContainedCount++;
      }
      // Partial start: selection starts inside embed code but ends after it
      else if (selectionStart > embed.startIndex && selectionStart < embed.endIndex && selectionEnd >= embed.endIndex) {
        intersectionType = 'partial-start';
        partiallyContainedCount++;
      }
      // Partial end: selection starts before embed code and ends inside it
      else if (selectionStart <= embed.startIndex && selectionEnd > embed.startIndex && selectionEnd < embed.endIndex) {
        intersectionType = 'partial-end';
        partiallyContainedCount++;
      }
      // Partial middle: selection is entirely within the embed code
      else {
        intersectionType = 'partial-middle';
        partiallyContainedCount++;
      }

      embedCodesInSelection.push({
        embedCodeIndex: i,
        embedCode: embed.embedCode,
        embedCodeStartIndex: embed.startIndex,
        embedCodeEndIndex: embed.endIndex,
        intersectionType
      });
    }
  }

  return {
    hasEmbedCodes: embedCodesInSelection.length > 0,
    embedCodesInSelection,
    fullyContainedCount,
    partiallyContainedCount
  };
}

function main(): void {
  const textarea = document.querySelector<HTMLTextAreaElement>("#editor");
  const output = document.querySelector<HTMLPreElement>("#output");
  const log = document.querySelector<HTMLPreElement>("#log");
  const embedFeedback = document.querySelector<HTMLPreElement>("#embedFeedback");
  const parsePerformance = document.querySelector<HTMLPreElement>("#parsePerformance");
  const caretEmbedStatus = document.querySelector<HTMLElement>("#caretEmbedStatus");

  if (!textarea || !output || !log || !embedFeedback || !parsePerformance || !caretEmbedStatus) {
    console.error("Required elements not found in the page.");
    return;
  }

  // Track last key pressed and current embed codes
  let lastKeyPressed: string = "(none)";
  let currentEmbedCodes: EmbedCodeLocation[] = [];

  // Track selection method
  let isMouseDown: boolean = false;
  let lastSelectionMethod: string = "unknown";
  let isShiftPressed: boolean = false;

  const appendLog = (line: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    log.textContent = `[${timestamp}] ${line}\n${log.textContent ?? ""}`;
  };

  const updateEmbedCodes = (): void => {
    console.log("updateEmbedCodes called");
    const startTime = performance.now();
    currentEmbedCodes = findEmbedCodes(textarea.value);
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(3);
    
    console.log(`Found ${currentEmbedCodes.length} embed codes in ${duration}ms`);
    appendLog(`Found ${currentEmbedCodes.length} embed code(s) in textarea (${duration}ms)`);

    // Update feedback section
    let feedbackText = `Count: ${currentEmbedCodes.length} embed code(s)\nIndexing time: ${duration}ms`;
    if (currentEmbedCodes.length > 0) {
      feedbackText += `\n\nPositions:`;
      currentEmbedCodes.forEach((loc, idx) => {
        feedbackText += `\n${idx + 1}. [${loc.startIndex}-${loc.endIndex}] ${loc.embedCode}`;
      });
    }
    embedFeedback.textContent = feedbackText;

    if (currentEmbedCodes.length > 0) {
      const details = currentEmbedCodes.map(loc =>
        `  ${loc.embedCode} [${loc.startIndex}-${loc.endIndex}]`
      ).join('\n');
      console.log(`Embed codes found:\n${details}`);
    }
  };

  const renderCurrentCaret = (label: string, eventDetail?: string, selectionMethod?: string): void => {
    const caret = getCaretInfo(textarea, textarea.selectionStart);
    const selectionEnd = textarea.selectionEnd;
    const hasSelection = selectionEnd !== textarea.selectionStart;

    let text = formatInfo(label, caret);
    
    // Show what triggered this update
    text += `\n\n=== EVENT INFO ===`;
    text += `\nTriggered by: ${label}`;
    if (eventDetail) {
      text += `\nDetails: ${eventDetail}`;
    }
    if (label === "Key") {
      text += `\nKey pressed: ${lastKeyPressed}`;
    }
    if (selectionMethod) {
      text += `\nSelection method: ${selectionMethod}`;
    }

    // Check if caret is inside an embed code
    const startTime = performance.now();
    const embedContext = getEmbedCodeContext(textarea.selectionStart, currentEmbedCodes);
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(3);

    // Update parse performance display
    parsePerformance.textContent = `Context parse time: ${duration}ms\n\nEmbed codes indexed: ${currentEmbedCodes.length}`;

    text += `\n\nInside embed code: ${embedContext.isInEmbedCode}`;
    if (embedContext.isInEmbedCode) {
      text += `\nEmbed code index: ${embedContext.embedCodeIndex}`;
      text += `\nEmbed code range: [${embedContext.embedCodeStartIndex}-${embedContext.embedCodeEndIndex}]`;
    }

    // Check for selection containing embed codes
    let selectionEmbedContext: SelectionEmbedContext | null = null;
    if (hasSelection) {
      const endCaret = getCaretInfo(textarea, selectionEnd);
      text += `\n\n=== SELECTION INFO ===`;
      text += `\nSelection end: index=${endCaret.index}, line=${endCaret.line}, column=${endCaret.column}`;
      text += `\nSelection length: ${selectionEnd - textarea.selectionStart} characters`;
      text += `\nSelected text: ${JSON.stringify(textarea.value.slice(textarea.selectionStart, selectionEnd))}`;

      // Check for embed codes in selection
      selectionEmbedContext = getSelectionEmbedContext(textarea.selectionStart, selectionEnd, currentEmbedCodes);

      text += `\n\n=== EMBED CODES IN SELECTION ===`;
      text += `\nContains embed codes: ${selectionEmbedContext.hasEmbedCodes}`;
      if (selectionEmbedContext.hasEmbedCodes) {
        text += `\nTotal embed codes affected: ${selectionEmbedContext.embedCodesInSelection.length}`;
        text += `\n  - Fully contained: ${selectionEmbedContext.fullyContainedCount}`;
        text += `\n  - Partially contained: ${selectionEmbedContext.partiallyContainedCount}`;
        text += `\n\nDetails:`;
        selectionEmbedContext.embedCodesInSelection.forEach((intersection, idx) => {
          text += `\n  ${idx + 1}. [${intersection.embedCodeStartIndex}-${intersection.embedCodeEndIndex}] ${intersection.intersectionType}`;
          text += `\n     ${intersection.embedCode}`;
        });
      }
    }

    // Update the caret/embed indicator panel next to the Reset button
    if (hasSelection && selectionEmbedContext && selectionEmbedContext.hasEmbedCodes) {
      let msg = `Yes - Selection contains ${selectionEmbedContext.embedCodesInSelection.length} embed code(s)`;
      if (selectionEmbedContext.fullyContainedCount > 0) {
        msg += ` (${selectionEmbedContext.fullyContainedCount} full`;
        if (selectionEmbedContext.partiallyContainedCount > 0) {
          msg += `, ${selectionEmbedContext.partiallyContainedCount} partial`;
        }
        msg += `)`;
      } else {
        msg += ` (${selectionEmbedContext.partiallyContainedCount} partial)`;
      }
      if (selectionMethod) {
        msg += ` - via ${selectionMethod}`;
      }
      caretEmbedStatus.textContent = msg;
      caretEmbedStatus.style.color = "#00703c";
    } else if (embedContext.isInEmbedCode) {
      let msg = "Yes - ";
      if (label === "Key") {
        msg += lastKeyPressed;
      } else {
        msg += " Mouse Click";
      }
      msg += ` - Embed code index: ${embedContext.embedCodeIndex}`;
      caretEmbedStatus.textContent = msg;
      caretEmbedStatus.style.color = "#00703c";
    } else {
      caretEmbedStatus.textContent = "No";
      caretEmbedStatus.style.color = "#d4351c";
    }

    output.textContent = text;
  };

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
  textarea.addEventListener("click", (event: MouseEvent) => {
    renderCurrentCaret("Click", `Mouse click at page coordinates (${event.pageX}, ${event.pageY})`);
    appendLog(
      `click at page(${event.pageX}, ${event.pageY}) -> caret index ${textarea.selectionStart}`
    );
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
    
    renderCurrentCaret("Key", `Keyboard interaction`, method);
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
    
    renderCurrentCaret("Selection", "Selection changed (drag-select, select-all, or other)", method);
  });

  textarea.addEventListener("focus", () => {
    renderCurrentCaret("Focus", "Textarea received focus (tab, click, or programmatic)");
    appendLog("textarea focused");
  });

  // Detect text changes and find embed codes - multiple events to catch all changes
  textarea.addEventListener("input", () => {
    console.log("Input event triggered");
    updateEmbedCodes();
  });

  textarea.addEventListener("change", () => {
    console.log("Change event triggered");
    updateEmbedCodes();
  });

  textarea.addEventListener("keyup", () => {
    updateEmbedCodes();
  });

  textarea.addEventListener("paste", () => {
    // Paste needs a small delay to get the updated value
    setTimeout(() => updateEmbedCodes(), 0);
  });

  // Initial scan on page load
  console.log("Running initial embed code scan");
  updateEmbedCodes();

  appendLog("Ready. Click or type in the textarea to see caret info update.");
}

document.addEventListener("DOMContentLoaded", main);
