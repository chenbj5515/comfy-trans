import { askAIStream, askAI } from './api';
import { TranslationMapValue, InsertPosition } from './types';
import { initializePageContext, initializeStyles, listenSelection } from "./initial";
import { createTranslatedParagraph, findInsertPosition, getTargetNode, insertTranslatedParagraph, appendLexicalUnit, addUnderlineToSelection } from "./dom";

// 存储页面上下文
let pageContext = '';

// 存储已翻译段落的映射
const translatedParagraphs = new Map<Node, HTMLParagraphElement>();

// 存储选中的文本和翻译的映射
const translationMap = new Map<string, TranslationMapValue>();

// 初始化函数
async function initialize() {
    pageContext = await initializePageContext();
    initializeStyles();
    listenSelection(processSelection);
}

// 处理选中文本事件
async function processSelection(selection: Selection, selectedText: string) {
    if (!selection.rangeCount) {
        return;
    }

    const range = selection.getRangeAt(0);
    const targetNode = getTargetNode(range);

    if (!targetNode) {
        console.log('未找到选中文本所在元素');
        return;
    }

    const paragraphInfo = translatedParagraphs.get(targetNode);
    if (paragraphInfo) {
        handleExistingTranslation(paragraphInfo, targetNode, selectedText, range, selection);
    } else {
        await createNewTranslation(targetNode, selectedText, range);
    }
}

// 段落的翻译已经存在的情况
async function handleExistingTranslation(
    existingTranslation: HTMLParagraphElement,
    targetNode: Element,
    selectedText: string,
    range: Range,
    selection: Selection
): Promise<boolean> {
    const paragraphId = targetNode.id;
    const translationData = translationMap.get(paragraphId);

    if (translationData?.originalText && translationData.originalText.includes(selectedText)) {
        await updateExistingTranslation(existingTranslation, selectedText, translationData.originalText, range);
        selection.removeAllRanges();
        return true;
    } else {
        return false;
    }
}

// 更新已存在的翻译
async function updateExistingTranslation(
    existingTranslation: HTMLParagraphElement,
    selectedText: string,
    originalText: string,
    range: Range
) {
    addUnderlineToSelection(range);

    // 创建含义和音标的容器
    existingTranslation.appendChild(document.createElement('div'));

    // 获取音标
    const phoneticText = await askAI(`「${selectedText}」这个单词/短语出现在「${originalText}」这个句子中，给出它的音标，如果是日文给平假名音标，如果是英文给国际音标，除了音标不要任何其他内容`);

    // 生成随机ID
    const selectedTextID = 'selected-text-' + Math.random().toString(36).substring(2, 15);

    appendLexicalUnit(existingTranslation, selectedText, phoneticText, selectedTextID);

    const stream = await askAIStream(`「${selectedText}」这个单词/短语出现在「${originalText}」这个句子中，分析它在这个句子中的意思。你只需要重点分析这个单词，不需要翻译整个句子。还有，如果这个词的词源可考的话也要说明出来。`);

    for await (const chunk of stream) {
        const selectedTextElement = document.getElementById(selectedTextID);
        if (selectedTextElement && chunk) {
            selectedTextElement.innerHTML += chunk;
        }
    }
}

// 创建新的翻译
async function createNewTranslation(targetNode: Element, selectedText: string, range: Range) {
    const insertAfterNode = findInsertPosition(range.startContainer);
    const translatedParagraph = createTranslatedParagraph(targetNode);

    if (insertAfterNode && insertAfterNode.parentNode) {
        const insertPosition: InsertPosition = {
            parentNode: {
                insertBefore: (node: Node, reference: Node | null) =>
                    insertAfterNode.parentNode!.insertBefore(node, reference)
            },
            nextSibling: insertAfterNode.nextSibling
        };

        insertTranslatedParagraph(translatedParagraph, insertPosition);
        translatedParagraphs.set(targetNode, translatedParagraph);

        // 创建翻译内容的div容器
        const translationDiv = document.createElement('div');
        translationDiv.id = 'translation-content-' + Math.random().toString(36).substring(2, 15);
        translatedParagraph.appendChild(translationDiv);

        const stream = await askAIStream(`请将「${selectedText}」翻译成中文。这个文本出现的上下文是: ${pageContext}，考虑这个上下文进行翻译，只输出翻译结果就好，不要输出任何其他内容`);

        let translationText = '';
        for await (const chunk of stream) {
            if (translationDiv && chunk) {
                translationDiv.innerHTML += chunk;
                translationText += chunk;
            }
        }
        translationMap.set(targetNode.id, {
            originalText: selectedText,
            translationText: translationText
        });
    } else {
        console.error('无法找到有效的插入位置');
    }
}

// 初始化并添加事件监听
console.log('开始初始化插件...');
initialize();
console.log('初始化完成');
