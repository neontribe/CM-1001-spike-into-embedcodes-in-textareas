export interface EmbedCodeLocation {
  embedCode: string;
  startIndex: number;
  endIndex: number;
}

export interface EmbedCodeContext {
  isInEmbedCode: boolean;
  embedCodeIndex: number;
  embedCodeStartIndex: number;
  embedCodeEndIndex: number;
}

export interface SelectionEmbedContext {
  hasEmbedCodes: boolean;
  embedCodesInSelection: EmbedCodeIntersection[];
  fullyContainedCount: number;
  partiallyContainedCount: number;
}

export interface EmbedCodeIntersection {
  embedCodeIndex: number;
  embedCode: string;
  embedCodeStartIndex: number;
  embedCodeEndIndex: number;
  intersectionType: 'full' | 'partial-start' | 'partial-end' | 'partial-middle';
}

export interface ActionRequired {
  selection: boolean;
  embedCodeIndex: number;
}