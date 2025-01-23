export interface TranslationMapValue {
    originalText: string;
    translationText: string;
}

export interface InsertPosition {
    parentNode: {
        insertBefore: (node: Node, reference: Node | null) => void;
    };
    nextSibling: Node | null;
}

export interface SpeakOptions {
    lang: string;
    rate: number;
} 