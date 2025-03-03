import { askAIStream } from "./api";
import { speakText } from './audio';
import { isJapaneseText, addFuriganaToJapanese } from './utils';

/**
 * 获取翻译后的HTML
 * @param originalHTML 原始HTML
 * @returns 翻译后的HTML
 */
export async function getTranslatedHTML(originalHTML: string): Promise<string> {
    // 向AI发送完整的HTML标签，请求翻译
    const stream = await askAIStream(`
    我会给你一个HTML标签及其内容，请将其中的文本内容翻译成中文，但保持HTML结构和属性不变。
    
    原始HTML:
    ${originalHTML}
    
    请返回完整的HTML标签，只将文本内容替换为中文翻译。不要添加任何解释或前缀，直接返回翻译后的HTML。
    `);
    
    let translatedHTML = '';
    
    for await (const chunk of stream) {
        if (chunk) {
            translatedHTML += chunk;
        }
    }
    
    console.log('获取到翻译后的HTML:', translatedHTML);
    
    // 清理可能的前缀和后缀文本
    translatedHTML = translatedHTML.trim();
    
    // 如果AI返回了带有代码块的回答，提取代码块内容
    if (translatedHTML.includes('```html')) {
        translatedHTML = translatedHTML.split('```html')[1].split('```')[0].trim();
    } else if (translatedHTML.includes('```')) {
        translatedHTML = translatedHTML.split('```')[1].split('```')[0].trim();
    }
    
    return translatedHTML;
}

/**
 * 根据字符数计算适当的宽度，以保持宽高比接近368:500
 * @param charCount 字符数量
 * @returns 计算得到的宽度（像素）
 */
export function calculateWidthFromCharCount(charCount: number): number {
    // 基准数据：361字符对应368px宽，164字符对应280px宽
    let width = 0;
    
    if (charCount <= 100) {
        width = 250; // 字符很少时的最小宽度
    } else if (charCount <= 200) {
        width = 280; // 约164字符时的宽度
    } else if (charCount <= 300) {
        width = 320;
    } else if (charCount <= 400) {
        width = 368; // 约361字符时的宽度
    } else {
        width = 400; // 字符很多时的最大宽度
    }
    
    console.log(`字符数: ${charCount}, 计算宽度: ${width}px`);
    return width;
}

/**
 * 创建翻译的div元素
 */
export function createTranslationDiv(): HTMLDivElement {
    const translationDiv = document.createElement('div');
    translationDiv.className = 'comfy-trans-translation';
    translationDiv.style.marginBottom = '10px';
    translationDiv.style.fontWeight = 'bold';
    translationDiv.style.wordBreak = 'break-word';
    translationDiv.style.whiteSpace = 'normal';
    translationDiv.style.fontSize = '14px';
    translationDiv.style.lineHeight = '1.9';
    return translationDiv;
}

/**
 * 创建解释的div元素
 */
export function createExplanationDiv(): HTMLDivElement {
    const explanationDiv = document.createElement('div');
    explanationDiv.className = 'comfy-trans-explanation';
    explanationDiv.style.wordBreak = 'break-word';
    explanationDiv.style.whiteSpace = 'normal';
    explanationDiv.style.fontSize = '14px';
    explanationDiv.style.lineHeight = '1.9';
    return explanationDiv;
}

/**
 * 创建原文的div元素
 */
export function createOriginalDiv(selectedText: string): { originalDiv: HTMLDivElement; originalText: HTMLSpanElement } {
    const originalDiv = document.createElement('div');
    originalDiv.className = 'comfy-trans-original';
    originalDiv.style.display = 'flex';
    originalDiv.style.alignItems = 'center';
    originalDiv.style.fontSize = '14px';
    originalDiv.style.lineHeight = '1.9';
    
    const originalText = document.createElement('span');
    originalText.textContent = selectedText;
    originalText.style.fontWeight = 'bold';
    originalText.style.fontSize = '14px';
    originalText.style.lineHeight = '1.9';
    originalText.style.cursor = 'pointer';
    originalText.addEventListener('click', () => {
        speakText(selectedText);
    });
    
    originalDiv.appendChild(originalText);
    return { originalDiv, originalText };
}

/**
 * 创建播放按钮
 */
export function createPlayButton(selectedText: string): HTMLSpanElement {
    const playButton = document.createElement('span');
    playButton.style.display = 'flex';
    playButton.style.alignItems = 'center';
    playButton.style.padding = '5px';
    playButton.style.cursor = 'pointer';
    playButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" height="18" width="18" style="cursor: pointer;">
            <path clip-rule="evenodd" fill-rule="evenodd" d="M11.26 3.691A1.2 1.2 0 0 1 12 4.8v14.4a1.199 1.199 0 0 1-2.048.848L5.503 15.6H2.4a1.2 1.2 0 0 1-1.2-1.2V9.6a1.2 1.2 0 0 1 1.2-1.2h3.103l4.449-4.448a1.2 1.2 0 0 1 1.308-.26Z"></path>
        </svg>
    `;
    playButton.addEventListener('click', (e) => {
        e.stopPropagation();
        speakText(selectedText);
    });
    return playButton;
}

/**
 * 处理翻译结果的更新
 */
export async function handleTranslationUpdate(
    translationDiv: HTMLDivElement,
    originalText: HTMLSpanElement,
    selectedText: string,
    translationPromise: Promise<string>
): Promise<void> {
    translationDiv.textContent = '正在翻译...';
    const translation = await translationPromise;
    translationDiv.textContent = translation;
    
    // 检查是否为日语文本
    if (isJapaneseText(selectedText)) {
        const textWithFurigana = await addFuriganaToJapanese(selectedText);
        originalText.innerHTML = textWithFurigana;
    }
}

/**
 * 处理解释内容的流式更新
 */
export async function handleExplanationStream(
    explanationDiv: HTMLDivElement,
    popup: HTMLElement,
    selectedText: string,
    translation: string
): Promise<void> {
    explanationDiv.innerHTML = '正在分析...';
    const explanationStream = await askAIStream(
        `「${selectedText}」这个单词/短语的含义是什么？简洁明了地分析它。如果这个词的词源可考的话也要说明出来。`
    );
    
    explanationDiv.innerHTML = '';
    let explanation = '';
    let chunkCount = 0;

    for await (const chunk of explanationStream) {
        if (explanationDiv && chunk) {
            explanationDiv.innerHTML += chunk;
            explanation += chunk;
            
            // 每接收10个数据块或累积一定字符数后，重新计算宽度
            chunkCount++;
            if (chunkCount % 10 === 0 || explanation.length % 50 === 0) {
                // 计算总字符数
                const totalChars = selectedText.length + translation.length + explanation.length;
                
                // 计算宽度
                const width = calculateWidthFromCharCount(totalChars);
                
                // 应用新宽度
                popup.style.width = `${width}px`;
                popup.style.maxWidth = `${width}px`;
            }
        }
    }
}