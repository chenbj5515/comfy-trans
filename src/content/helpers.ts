import { askAIStream } from "./api";

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