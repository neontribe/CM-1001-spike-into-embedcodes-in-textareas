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

  const renderCurrentCaret = (label: string, eventDetail?: string): void => {
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

    // Update the caret/embed indicator panel next to the Reset button
    if (embedContext.isInEmbedCode) {
      let msg = "Yes - ";
      if (label === "Key") {
        msg += '"' + lastKeyPressed + '"';
      } else {
        msg += " Mouse Click";
      }
      caretEmbedStatus.textContent = msg;
      caretEmbedStatus.style.color = "#00703c";
    } else {
      caretEmbedStatus.textContent = "No";
      caretEmbedStatus.style.color = "#d4351c";
    }

    if (hasSelection) {
      const endCaret = getCaretInfo(textarea, selectionEnd);
      text += `\n\nSelection end: index=${endCaret.index}, line=${endCaret.line}, column=${endCaret.column}`;
      text += `\nSelected text: ${JSON.stringify(textarea.value.slice(textarea.selectionStart, selectionEnd))}`;
    }

    output.textContent = text;
  };

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
  });

  // Keyboard-driven cursor movement (arrow keys, home/end, typing, etc).
  textarea.addEventListener("keyup", () => {
    renderCurrentCaret("Key", `Keyboard interaction`);
  });

  // Catches selection changes not covered above (e.g. select-all via menu,
  // drag-selecting with the mouse).
  document.addEventListener("selectionchange", () => {
    if (document.activeElement !== textarea) return;
    renderCurrentCaret("Selection", "Selection changed (drag-select, select-all, or other)");
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
