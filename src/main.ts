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

function main(): void {
  const textarea = document.querySelector<HTMLTextAreaElement>("#editor");
  const output = document.querySelector<HTMLPreElement>("#output");
  const log = document.querySelector<HTMLPreElement>("#log");
  const embedFeedback = document.querySelector<HTMLPreElement>("#embedFeedback");

  if (!textarea || !output || !log || !embedFeedback) {
    console.error("Required elements not found in the page.");
    return;
  }

  const appendLog = (line: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    log.textContent = `[${timestamp}] ${line}\n${log.textContent ?? ""}`;
  };

  const updateEmbedCodes = (): void => {
    console.log("updateEmbedCodes called");
    const startTime = performance.now();
    const embedCodes = findEmbedCodes(textarea.value);
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(3);
    
    console.log(`Found ${embedCodes.length} embed codes in ${duration}ms`);
    appendLog(`Found ${embedCodes.length} embed code(s) in textarea (${duration}ms)`);

    // Update feedback section
    let feedbackText = `Count: ${embedCodes.length} embed code(s)\nIndexing time: ${duration}ms`;
    if (embedCodes.length > 0) {
      feedbackText += `\n\nPositions:`;
      embedCodes.forEach((loc, idx) => {
        feedbackText += `\n${idx + 1}. [${loc.startIndex}-${loc.endIndex}] ${loc.embedCode}`;
      });
    }
    embedFeedback.textContent = feedbackText;

    if (embedCodes.length > 0) {
      const details = embedCodes.map(loc =>
        `  ${loc.embedCode} [${loc.startIndex}-${loc.endIndex}]`
      ).join('\n');
      console.log(`Embed codes found:\n${details}`);
    }
  };

  const renderCurrentCaret = (label: string): void => {
    const caret = getCaretInfo(textarea, textarea.selectionStart);
    const selectionEnd = textarea.selectionEnd;
    const hasSelection = selectionEnd !== textarea.selectionStart;

    let text = formatInfo(label, caret);
    if (hasSelection) {
      const endCaret = getCaretInfo(textarea, selectionEnd);
      text += `\nSelection end: index=${endCaret.index}, line=${endCaret.line}, column=${endCaret.column}`;
      text += `\nSelected text: ${JSON.stringify(textarea.value.slice(textarea.selectionStart, selectionEnd))}`;
    }

    output.textContent = text;
  };

  // Mouse click: fires after the browser has already moved the caret,
  // so selectionStart/selectionEnd reflect the click position.
  textarea.addEventListener("click", (event: MouseEvent) => {
    renderCurrentCaret("Click");
    appendLog(
      `click at page(${event.pageX}, ${event.pageY}) -> caret index ${textarea.selectionStart}`
    );
  });

  // Keyboard-driven cursor movement (arrow keys, home/end, typing, etc).
  textarea.addEventListener("keyup", () => {
    renderCurrentCaret("Key");
  });

  // Catches selection changes not covered above (e.g. select-all via menu,
  // drag-selecting with the mouse).
  document.addEventListener("selectionchange", () => {
    if (document.activeElement !== textarea) return;
    renderCurrentCaret("Selection");
  });

  textarea.addEventListener("focus", () => {
    renderCurrentCaret("Focus");
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
