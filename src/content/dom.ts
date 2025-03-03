import { InsertPosition } from "./types";
import { speakText } from "./audio";
import { calculateWidthFromCharCount } from './helpers';

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

/**
 * 1. 找到段落的插入位置
 * @param targetNode 目标节点
 * @returns 插入位置对象，如果找不到则返回null
 */
export function findParagraphInsertPosition(targetNode: Element): InsertPosition | null {
    const insertAfterNode = findInsertPosition(targetNode);
    
    if (!insertAfterNode || !insertAfterNode.parentNode) {
        return null;
    }
    
    return {
        parentNode: {
            insertBefore: (node: Node, reference: Node | null) =>
                insertAfterNode.parentNode!.insertBefore(node, reference)
        },
        nextSibling: insertAfterNode.nextSibling
    };
}

/**
 * 2. 创建临时容器
 * @returns 创建的临时容器元素
 */
export function createTempContainer(): HTMLDivElement {
    const tempContainer = document.createElement('div');
    tempContainer.className = 'comfy-trans-temp-container';
    tempContainer.innerHTML = '<div class="comfy-trans-loading">正在翻译...</div>';
    return tempContainer;
}

/**
 * 3. 插入临时容器到DOM
 * @param tempContainer 临时容器元素
 * @param insertPosition 插入位置
 */
export function insertTempContainer(tempContainer: HTMLDivElement, insertPosition: InsertPosition): void {
    insertTranslatedParagraph(tempContainer, insertPosition);
}

/**
 * 5. 创建并插入翻译后的节点
 * @param translatedHTML 翻译后的HTML
 * @param tempContainer 临时容器，将被替换
 */
export function replaceWithTranslatedNode(translatedHTML: string, tempContainer: HTMLDivElement): void {
    // 创建翻译后的元素
    const translatedElement = document.createElement('div');
    translatedElement.innerHTML = translatedHTML;
    
    // 获取翻译后的节点
    const translatedNode = translatedElement.firstChild as HTMLElement;
    
    if (translatedNode) {
        // 直接使用AI返回的结果，不添加额外的类名和样式
        // 替换临时容器
        tempContainer.replaceWith(translatedNode);
        console.log('翻译完成，已插入翻译后的HTML');
    } else {
        console.error('无法解析翻译后的HTML');
        tempContainer.innerHTML = '翻译失败，无法解析翻译后的HTML';
    }
}

// 为选中文本添加下划线并关联弹窗
export function addUnderlineWithPopup(range: Range, selectedText: string, popupId: string): HTMLSpanElement {
    const textNode = range.startContainer as Text;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    const beforeText = textNode.textContent?.substring(0, startOffset) || '';
    const afterText = textNode.textContent?.substring(endOffset) || '';

    // 创建带下划线的span
    const span = document.createElement('span');
    span.className = 'comfy-trans-underlined';
    span.textContent = selectedText;
    span.style.textDecoration = 'underline';
    span.style.textDecorationStyle = 'dotted';
    span.style.textDecorationColor = '#3498db';
    span.style.cursor = 'pointer';
    span.style.position = 'relative';
    span.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
    
    // 设置popup id到dataset
    span.dataset.popup = popupId;
    
    // 添加鼠标悬停事件
    span.addEventListener('mouseenter', handlePopupDisplay);
    
    // 添加点击事件，防止点击下划线文本时关闭Popup
    span.addEventListener('click', handlePopupDisplay);
    
    // 替换原始文本节点
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(beforeText));
    fragment.appendChild(span);
    fragment.appendChild(document.createTextNode(afterText));

    if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
    }
    
    return span;
}

// 处理Popup显示的统一函数
export function handlePopupDisplay(e: MouseEvent) {
    console.log('处理Popup显示，事件类型:', e.type, '目标元素:', e.target);
    e.stopPropagation();
    
    const span = e.currentTarget as HTMLElement;
    const popupId = span.dataset.popup;
    
    // 如果是点击事件，播放文本
    if (e.type === 'click') {
        const text = span.textContent || '';
        speakText(text);
    }
    
    console.log('获取到Popup ID:', popupId);
    
    if (popupId) {
        const popup = document.getElementById(popupId);
        console.log('找到Popup元素:', popup);
        
        if (popup) {
            // 获取当前显示的弹窗
            const currentVisiblePopup = (window as any).currentVisiblePopup;
            console.log('currentVisiblePopup:', currentVisiblePopup);
            if (currentVisiblePopup) {
                return;
            }
            
            // 更新当前显示的Popup
            (window as any).currentVisiblePopup = popup as HTMLElement;
            
            // 先设置为可见，以便计算尺寸
            popup.style.display = 'block';
            popup.style.opacity = '1';
            popup.style.visibility = 'visible';
            console.log('设置Popup为可见，当前状态:', popup.style.display, popup.style.opacity, popup.style.visibility);
            
            // 使用setTimeout确保DOM已更新
            setTimeout(() => {
                console.log('setTimeout回调执行，设置Popup位置');
                // 计算位置
                const rect = span.getBoundingClientRect();
                const popupRect = popup.getBoundingClientRect();
                console.log('span位置:', rect);
                console.log('Popup尺寸:', popupRect);
                
                // 使用存储的最终宽度，如果有的话
                if (popup.dataset.finalWidth) {
                    const finalWidth = parseInt(popup.dataset.finalWidth);
                    console.log('使用存储的最终宽度:', finalWidth);
                    popup.style.width = `${finalWidth}px`;
                    popup.style.maxWidth = `${finalWidth}px`;
                }
                
                // 将悬浮窗定位在单词的右下角
                let posX = rect.right;
                let posY = rect.bottom;
                console.log('初始计算位置(右下角):', posX, posY);
                
                // 检查是否会超出视窗右侧
                if (posX + popupRect.width > window.innerWidth + window.scrollX) {
                    // 如果超出右侧，则显示在左侧
                    posX = rect.left - popupRect.width;
                    console.log('调整水平位置，避免超出右侧:', posX);
                }
                
                // 检查是否会超出视窗底部
                if (posY + popupRect.height > window.innerHeight + window.scrollY) {
                    // 如果超出底部，则显示在上方
                    posY = rect.top - popupRect.height;
                    console.log('调整垂直位置，避免超出底部:', posY);
                }
                
                // 设置最终位置，使用absolute定位而不是fixed
                popup.style.position = 'absolute';
                popup.style.left = `${posX + window.scrollX}px`;
                popup.style.top = `${posY + window.scrollY}px`;
                console.log('设置Popup最终位置:', posX + window.scrollX, posY + window.scrollY, '当前状态:', popup.style.display, popup.style.opacity);
            }, 0);
        } else {
            console.error('未找到Popup元素，ID:', popupId);
        }
    } else {
        console.log('span没有关联的Popup ID');
    }
}

// 判断是否选中了整个段落
export function isEntireParagraphSelected(targetNode: Element, selectedText: string): boolean {
    // 如果选中的文本与节点的文本内容相同，则认为选中了整个段落
    const nodeText = targetNode.textContent?.trim() || '';
    return nodeText === selectedText;
}

// 创建弹窗
export function createPopup(popupId: string): HTMLElement {
    console.log('调用createPopup函数');
    // 创建弹窗元素
    let popup = document.createElement('div');
    popup.id = popupId;
    popup.className = 'comfy-trans-popup';
    popup.style.cssText = `
        position: absolute;
        overflow: visible;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        display: block;
        opacity: 1;
        visibility: visible;
        font-size: 14px;
        line-height: 1.5;
        transition: opacity 0.3s ease;
    `;
    console.log('设置弹窗基本样式');

    // 创建内容容器
    const content = document.createElement('div');
    content.className = 'comfy-trans-content';
    console.log('创建内容容器');

    // 添加到弹窗
    popup.appendChild(content);
    console.log('将内容容器添加到弹窗');

    // 添加到文档
    document.body.appendChild(popup);
    console.log('将弹窗添加到文档');

    // 点击页面其他区域关闭弹窗
    document.addEventListener('click', (e) => {
        if (popup.style.display === 'block' && !popup.contains(e.target as Node)) {
            console.log('createPopup中的全局点击事件：点击发生在弹窗外部，关闭弹窗，点击的元素:', e.target);
            popup.style.display = 'none';
            
            // 重置全局变量
            if ((window as any).currentVisiblePopup === popup) {
                (window as any).currentVisiblePopup = null;
            }
        }
    });
    console.log('添加点击事件监听');

    return popup;
}

// 显示弹窗
export function showPopup(text: string, x: number, y: number, popupId: string): HTMLElement {
    console.log('调用showPopup函数，文本:', text, '位置:', x, y);
    const popup = createPopup(popupId);
    
    // 更新当前显示的弹窗
    (window as any).currentVisiblePopup = popup;
    
    console.log(popup, '创建弹窗完成');
    const content = popup.querySelector('.comfy-trans-content') as HTMLElement;
    
    // 清空内容
    content.innerHTML = '<div class="comfy-trans-loading">正在翻译...</div>';
    console.log('设置加载提示');
    
    // 根据文本长度初步估计弹窗宽度
    const textLength = text.length;
    console.log('文本长度:', textLength);
    
    // 根据文本长度计算初始宽度
    const width = calculateWidthFromCharCount(textLength);
    popup.style.width = `${width}px`;
    popup.style.maxWidth = `${width}px`;
    
    // 先设置为可见，以便计算尺寸
    popup.style.display = 'block';
    popup.style.opacity = '1';
    popup.style.visibility = 'visible';
    console.log('设置弹窗为可见，以便计算尺寸');
    
    // 设置主题
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDarkMode) {
        popup.classList.add('dark-theme');
        popup.classList.remove('light-theme');
        popup.style.backgroundColor = '#2d2d2d';
        popup.style.color = '#f0f0f0';
        popup.style.border = '1px solid #444';
    } else {
        popup.classList.add('light-theme');
        popup.classList.remove('dark-theme');
        popup.style.backgroundColor = '#f9f9f9';
        popup.style.color = '#333';
        popup.style.border = '1px solid #ddd';
    }
    console.log('设置主题样式完成');
    
    // 立即设置位置，使用absolute定位
    popup.style.position = 'absolute';
    popup.style.left = `${x + window.scrollX}px`;
    popup.style.top = `${y + window.scrollY}px`;
    console.log('设置初始位置:', x + window.scrollX, y + window.scrollY);
    
    // 使用setTimeout确保DOM已更新
    setTimeout(() => {
        // 获取弹窗尺寸
        const popupRect = popup.getBoundingClientRect();
        console.log('弹窗尺寸:', popupRect.width, popupRect.height);
        
        // 计算位置，确保在选中文本右侧偏下
        let posX = x;
        let posY = y;
        console.log('初始位置:', posX, posY);
        
        // 检查是否会超出视窗右侧
        if (posX + popupRect.width > window.innerWidth + window.scrollX) {
            // 如果超出右侧，则显示在左侧
            posX = x - popupRect.width - 10;
            console.log('调整水平位置，避免超出右侧:', posX);
        }
        
        // 检查是否会超出视窗底部
        if (posY + popupRect.height > window.innerHeight + window.scrollY) {
            // 如果超出底部，则向上调整
            posY = window.innerHeight + window.scrollY - popupRect.height - 10;
            console.log('调整垂直位置，避免超出底部:', posY);
        }
        
        // 设置最终位置，使用absolute定位
        popup.style.position = 'absolute';
        popup.style.left = `${posX + window.scrollX}px`;
        popup.style.top = `${posY + window.scrollY}px`;
        console.log('设置最终位置:', posX + window.scrollX, posY + window.scrollY);
        
        console.log('弹窗位置:', posX + window.scrollX, posY + window.scrollY, '弹窗尺寸:', popupRect.width, popupRect.height);
    }, 0);
    
    return popup;
}
