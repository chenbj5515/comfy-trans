import { InsertPosition } from "./types";
import { speakText } from "./audio";

// 获取目标节点
export function getTargetNode(range: Range): Element | null {
    let targetNode: Node | null = range.startContainer;

    if (targetNode.nodeType === Node.TEXT_NODE) {
        targetNode = targetNode.parentElement;
    }

    return targetNode as Element;
}

// 查找插入位置
export function findInsertPosition(startContainer: Node): Node {
    let insertAfterNode = startContainer;

    if (insertAfterNode.nodeType === Node.TEXT_NODE) {
        let nextSibling = insertAfterNode.nextSibling;
        while (nextSibling) {
            if (nextSibling.nodeName === 'BR') {
                insertAfterNode = nextSibling;
                break;
            }
            if (nextSibling.nodeType === Node.TEXT_NODE) {
                break;
            }
            nextSibling = nextSibling.nextSibling;
        }
    }

    return insertAfterNode;
}

// 创建翻译段落元素
export function createTranslatedParagraph(targetNode: Node): HTMLParagraphElement {
    const translatedParagraph = document.createElement('p');
    translatedParagraph.className = 'translation-paragraph';
    if (targetNode instanceof Element) {
        translatedParagraph.style.cssText = window.getComputedStyle(targetNode).cssText;
    }
    return translatedParagraph;
}

// 插入翻译段落
export function insertTranslatedParagraph(translatedParagraph: HTMLParagraphElement, insertPosition: InsertPosition) {
    insertPosition.parentNode.insertBefore(translatedParagraph, insertPosition.nextSibling);
}

// 添加含义和音标到翻译中
export function appendLexicalUnit(translationParagraph: HTMLParagraphElement, selectedText: string, phoneticText: string, selectedTextID: string) {
    const playButtonID = `play-button-${Math.random().toString(36).substring(2, 15)}`;
    
    // 创建外层容器
    const selectedTextDiv = document.createElement('div');
    selectedTextDiv.className = 'selected-text';
    
    // 创建文本和音标容器
    const textContainer = document.createElement('div');
    textContainer.style.cssText = 'display: flex; align-items: center; white-space: nowrap; font-weight: bold;';
    
    // 添加文本和音标
    const displayText = phoneticText ? `${selectedText}(${phoneticText})` : selectedText;
    textContainer.appendChild(document.createTextNode(displayText));
    
    // 添加间隔
    const spacer = document.createElement('span');
    spacer.style.width = '10px';
    textContainer.appendChild(spacer);
    
    // 创建播放按钮
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('height', '20');
    svg.setAttribute('width', '24');
    svg.id = playButtonID;
    svg.style.cursor = 'pointer';
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('clip-rule', 'evenodd');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', 'M11.26 3.691A1.2 1.2 0 0 1 12 4.8v14.4a1.199 1.199 0 0 1-2.048.848L5.503 15.6H2.4a1.2 1.2 0 0 1-1.2-1.2V9.6a1.2 1.2 0 0 1 1.2-1.2h3.103l4.449-4.448a1.2 1.2 0 0 1 1.308-.26Zm6.328-.176a1.2 1.2 0 0 1 1.697 0A11.967 11.967 0 0 1 22.8 12a11.966 11.966 0 0 1-3.515 8.485 1.2 1.2 0 0 1-1.697-1.697A9.563 9.563 0 0 0 20.4 12a9.565 9.565 0 0 0-2.812-6.788 1.2 1.2 0 0 1 0-1.697Zm-3.394 3.393a1.2 1.2 0 0 1 1.698 0A7.178 7.178 0 0 1 18 12a7.18 7.18 0 0 1-2.108 5.092 1.2 1.2 0 1 1-1.698-1.698A4.782 4.782 0 0 0 15.6 12a4.78 4.78 0 0 0-1.406-3.394 1.2 1.2 0 0 1 0-1.698Z');
    
    svg.appendChild(path);
    textContainer.appendChild(svg);
    
    // 创建含义容器
    const meaningDiv = document.createElement('div');
    meaningDiv.className = 'selected-text-meaning';
    meaningDiv.id = selectedTextID;
    
    // 组装所有元素
    selectedTextDiv.appendChild(textContainer);
    selectedTextDiv.appendChild(meaningDiv);
    translationParagraph.appendChild(selectedTextDiv);
    
    // 添加点击事件监听器
    svg.addEventListener('click', () => {
        speakText(selectedText);
    });
}

// 为选中文本添加下划线
export function addUnderlineToSelection(range: Range): HTMLSpanElement {
    const textNode = range.startContainer as Text;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    const beforeText = textNode.textContent?.substring(0, startOffset) || '';
    const selectedContent = textNode.textContent?.substring(startOffset, endOffset) || '';
    const afterText = textNode.textContent?.substring(endOffset) || '';

    const span = document.createElement('span');
    span.className = 'comfy-trans-underlined';
    span.style.textDecoration = 'underline';
    span.style.textDecorationStyle = 'dotted';
    span.style.textDecorationColor = '#3498db';
    span.style.cursor = 'pointer';
    span.textContent = selectedContent;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(beforeText));
    fragment.appendChild(span);
    fragment.appendChild(document.createTextNode(afterText));

    if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
    }
    
    return span;
}