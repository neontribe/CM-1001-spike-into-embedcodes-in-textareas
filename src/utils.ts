import type {
    ActionRequired,
    EmbedCodeContext,
    EmbedCodeIntersection,
    EmbedCodeLocation,
    SelectionEmbedContext
} from "./@types/types";
import embedRegex from "./regex.js";

/**
 * Utility class for working with embed codes in text
 */
export class EmbedCodeUtils {
    /**
     * Find all embed codes in the given text
     */
    findEmbedCodes(text: string): EmbedCodeLocation[] {
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

    /**
     * Get context information about whether the caret is inside an embed code
     */
    getEmbedCodeContext(caretIndex: number, embedCodes: EmbedCodeLocation[]): EmbedCodeContext| null {
        for (let i = 0; i < embedCodes.length; i++) {
            const embed = embedCodes[i];
            if (caretIndex > embed.startIndex && caretIndex < embed.endIndex) {
                return {
                    isInEmbedCode: true,
                    embedCodeIndex: i,
                    embedCodeStartIndex: embed.startIndex,
                    embedCodeEndIndex: embed.endIndex
                };
            }
        }

        return null;
    }

    /**
     * Get information about embed codes within a text selection
     */
    getSelectionEmbedContext(selectionStart: number, selectionEnd: number, embedCodes: EmbedCodeLocation[]): SelectionEmbedContext {
        const embedCodesInSelection: EmbedCodeIntersection[] = [];
        let fullyContainedCount = 0;
        let partiallyContainedCount = 0;

        for (let i = 0; i < embedCodes.length; i++) {
            const embed = embedCodes[i];
            if (selectionStart < embed.endIndex && selectionEnd > embed.startIndex) {
                let intersectionType: 'full' | 'partial-start' | 'partial-end' | 'partial-middle';
                if (selectionStart <= embed.startIndex && selectionEnd >= embed.endIndex) {
                    intersectionType = 'full';
                    fullyContainedCount++;
                }
                else if (selectionStart > embed.startIndex && selectionStart < embed.endIndex && selectionEnd >= embed.endIndex) {
                    intersectionType = 'partial-start';
                    partiallyContainedCount++;
                }
                else if (selectionStart <= embed.startIndex && selectionEnd > embed.startIndex && selectionEnd < embed.endIndex) {
                    intersectionType = 'partial-end';
                    partiallyContainedCount++;
                }
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

    isActionIsRequired(textarea: HTMLTextAreaElement, currentEmbedCodes: EmbedCodeLocation[]): ActionRequired | null {
        const embedContext = this.getEmbedCodeContext(textarea.selectionStart, currentEmbedCodes);
        if (embedContext == null) {
            return null;
        }
        const selectionEnd = textarea.selectionEnd;
        const hasSelection = selectionEnd !== textarea.selectionStart;

        // Check for selection containing embed codes
        let selectionEmbedContext: SelectionEmbedContext | null = null;
        if (hasSelection) {
            selectionEmbedContext = this.getSelectionEmbedContext(textarea.selectionStart, selectionEnd, currentEmbedCodes);
        }
        if (hasSelection && selectionEmbedContext && selectionEmbedContext.hasEmbedCodes) {
            return {
                selection: true,
                embedCodeIndex: embedContext.embedCodeIndex,
            }
        } else if (embedContext.isInEmbedCode) {
            return {
                selection: false,
                embedCodeIndex: embedContext.embedCodeIndex,
            }
        } else {
            return null;
        }
    }
}