import { askAIStream, askAI } from './api';
import { InsertPosition } from './types';
import { initializeStyles } from "./initial";
import { findInsertPosition, getTargetNode, insertTranslatedParagraph } from "./dom";
import { isChineseText, isJapaneseText, addFuriganaToJapanese } from './utils';
import { speakText } from './audio';

/**
 * 根据字符数计算适当的宽度，以保持宽高比接近368:500
 * @param charCount 字符数量
 * @returns 计算得到的宽度（像素）
 */
function calculateWidthFromCharCount(charCount: number): number {
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

// 跟踪当前显示的悬浮窗
let currentVisiblePopup: HTMLElement | null = null;

// 初始化函数
async function initialize() {
    try {
        
        initializeStyles();
        
        // 监听键盘事件
        document.addEventListener('keydown', (e) => {
            console.log('检测到键盘事件:', e.key);
            if (e.key.toLowerCase() === 't') {
                console.log('检测到按键T');
                const selection = window.getSelection();
                if (!selection || !selection.toString().trim()) {
                    console.log('没有选中文本');
                    return;
                }
                e.preventDefault(); // 阻止默认行为
                e.stopPropagation(); // 阻止事件冒泡
                console.log('检测到按键T，处理选中文本:', selection.toString().trim());
                processSelection(selection);
            }
        }, true); // 添加 true 参数，使用捕获阶段
        
        console.log('翻译插件初始化完成');
    } catch (error) {
        console.error('初始化插件时出错:', error);
    }
}

// 创建弹窗
function createPopup(popupId: string): HTMLElement {
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
            if (currentVisiblePopup === popup) {
                currentVisiblePopup = null;
            }
        }
    });
    console.log('添加点击事件监听');

    return popup;
}

// 显示弹窗
function showPopup(text: string, x: number, y: number, popupId: string): HTMLElement {
    console.log('调用showPopup函数，文本:', text, '位置:', x, y);
    const popup = createPopup(popupId);
    
    // 更新当前显示的弹窗
    currentVisiblePopup = popup;
    
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

// 处理选中文本事件
async function processSelection(selection: Selection) {
    console.log('进入processSelection函数');
    if (!selection.rangeCount) {
        console.log('没有选中范围，退出');
        return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
        console.log('没有选中文本，退出');
        return;
    }

    // 检查是否为中文或日文
    if (isChineseText(selectedText)) {
        console.log('检测到中文文本，跳过翻译:', selectedText);
        return;
    }

    const range = selection.getRangeAt(0);
    const targetNode = getTargetNode(range);

    if (!targetNode) {
        console.log('未找到选中文本所在元素');
        return;
    }

    // 获取选中文本的位置
    const rect = range.getBoundingClientRect();
    // 在选中文本右侧偏下一点显示
    const x = rect.right + 5; // 右侧偏移5px
    const y = rect.top + rect.height / 2; // 垂直居中偏下

    // 判断是否选中了整个段落
    const isFullParagraph = isEntireParagraphSelected(targetNode, selectedText);

    if (isFullParagraph) {
        console.log('处理整段翻译');
        // 处理整个段落的翻译
        await translateFullParagraph(targetNode);
    } else {
        console.log('处理部分文本翻译');
        // 处理部分文本的翻译
        await translatePartialText(selectedText, x, y, range);
    }
}

// 判断是否选中了整个段落
function isEntireParagraphSelected(targetNode: Element, selectedText: string): boolean {
    // 如果选中的文本与节点的文本内容相同，则认为选中了整个段落
    const nodeText = targetNode.textContent?.trim() || '';
    return nodeText === selectedText;
}

// 处理整个段落的翻译
async function translateFullParagraph(targetNode: Element) {
    // 1. 找到插入位置
    const insertPosition = findParagraphInsertPosition(targetNode);
    if (!insertPosition) {
        console.error('无法找到有效的插入位置');
        return;
    }

    // 2. 创建临时容器
    const originalHTML = targetNode.outerHTML;
    const tempContainer = createTempContainer();
    
    // 3. 插入临时容器
    insertTempContainer(tempContainer, insertPosition);
    
    try {
        // 4. 发送原始HTML到AI并处理结果
        const translatedHTML = await getTranslatedHTML(originalHTML);
        
        // 5. 创建并插入翻译后的节点
        replaceWithTranslatedNode(translatedHTML, tempContainer);
    } catch (error) {
        console.error('翻译过程中出错:', error);
        tempContainer.innerHTML = '翻译失败，请查看控制台获取详细错误信息';
    }
}

/**
 * 1. 找到段落的插入位置
 * @param targetNode 目标节点
 * @returns 插入位置对象，如果找不到则返回null
 */
function findParagraphInsertPosition(targetNode: Element): InsertPosition | null {
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
function createTempContainer(): HTMLDivElement {
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
function insertTempContainer(tempContainer: HTMLDivElement, insertPosition: InsertPosition): void {
    insertTranslatedParagraph(tempContainer, insertPosition);
}

/**
 * 4. 获取翻译后的HTML
 * @param originalHTML 原始HTML
 * @returns 翻译后的HTML
 */
async function getTranslatedHTML(originalHTML: string): Promise<string> {
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
 * 5. 创建并插入翻译后的节点
 * @param translatedHTML 翻译后的HTML
 * @param tempContainer 临时容器，将被替换
 */
function replaceWithTranslatedNode(translatedHTML: string, tempContainer: HTMLDivElement): void {
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

// 处理部分文本的翻译
async function translatePartialText(selectedText: string, x: number, y: number, range: Range) {
    console.log('开始翻译部分文本:', selectedText, '位置:', x, y);
    
    try {
        const popupId = `comfy-trans-popup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // 为选中文本添加下划线并创建带有悬浮提示的span
        addUnderlineWithPopup(range, selectedText, popupId);
        
        // 显示弹窗
        const popup = showPopup(selectedText, x, y, popupId);
        console.log('弹窗显示完成，获取内容容器');
        const content = popup.querySelector('.comfy-trans-content') as HTMLElement;
        
        // 更新当前显示的弹窗
        currentVisiblePopup = popup;
        
        // 获取翻译和解释
        const translationPromise = askAI(`请将「${selectedText}」翻译成中文。只输出翻译结果就好，不要输出任何其他内容`);
        
        // 创建翻译和解释的容器
        console.log('创建翻译和解释的容器');
        const translationDiv = document.createElement('div');
        translationDiv.className = 'comfy-trans-translation';
        translationDiv.style.marginBottom = '10px';
        translationDiv.style.fontWeight = 'bold';
        translationDiv.style.wordBreak = 'break-word';
        translationDiv.style.whiteSpace = 'normal';
        translationDiv.style.fontSize = '14px';
        translationDiv.style.lineHeight = '1.9';
        
        const explanationDiv = document.createElement('div');
        explanationDiv.className = 'comfy-trans-explanation';
        explanationDiv.style.wordBreak = 'break-word';
        explanationDiv.style.whiteSpace = 'normal';
        explanationDiv.style.fontSize = '14px';
        explanationDiv.style.lineHeight = '1.9';
        
        // 清空加载提示并添加容器
        console.log('清空加载提示并添加容器');
        content.innerHTML = '';
        content.appendChild(translationDiv);
        content.appendChild(explanationDiv);
        
        // 添加原文和播放按钮
        console.log('添加原文和播放按钮');
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
        
        originalDiv.appendChild(originalText);
        originalDiv.appendChild(playButton);
        content.insertBefore(originalDiv, content.firstChild);
        console.log('原文和播放按钮添加完成');
        
        // 显示翻译结果
        console.log('等待翻译结果');
        translationDiv.textContent = '正在翻译...';
        let translation = await translationPromise;
        console.log('获取到翻译结果:', translation);
        
        // 检查翻译结果是否为日语文本，如果是，则添加平假名
        console.log('检查翻译结果是否为日语文本1:', selectedText);
        console.log('检查翻译结果是否为日语文本2:', isJapaneseText(selectedText));
        if (isJapaneseText(selectedText)) {
            console.log('检测到日语文本，添加平假名');
            // 不修改translationDiv，而是修改原文标题元素
            const textWithFurigana = await addFuriganaToJapanese(selectedText);
            
            // 使用innerHTML设置带有ruby标签的内容
            originalText.innerHTML = textWithFurigana;
            
            // 更新点击事件，确保播放的是原始文本
            originalText.addEventListener('click', () => {
                console.log('点击播放按钮', selectedText);
                speakText(selectedText);
            });
            
            playButton.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('点击播放按钮', selectedText);
                speakText(selectedText);
            });
            
            // 翻译div仍然显示普通的中文翻译
            translationDiv.textContent = translation;
        } else {
            translationDiv.textContent = translation;
        }
        
        // 流式显示解释
        console.log('开始获取解释');
        explanationDiv.innerHTML = '正在分析...';
        const explanationStream = await askAIStream(`「${selectedText}」这个单词/短语的含义是什么？简洁明了地分析它。如果这个词的词源可考的话也要说明出来。`);
        
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
                    console.log('当前总字符数:', totalChars);
                    
                    // 计算宽度
                    const width = calculateWidthFromCharCount(totalChars);
                    
                    // 应用新宽度
                    popup.style.width = `${width}px`;
                    popup.style.maxWidth = `${width}px`;
                }
            }
        }
        console.log('解释获取完成');
        
        // 创建Popup并存储翻译结果和解释
        console.log('创建Popup并存储翻译结果和解释');
        
    } catch (error) {
        console.error('翻译过程中出错:', error);
        alert('翻译失败，请查看控制台获取详细错误信息');
    }
}

// 为选中文本添加下划线
function addUnderlineWithPopup(range: Range, selectedText: string, popupId: string): HTMLSpanElement {
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
function handlePopupDisplay(e: MouseEvent) {
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
            console.log('currentVisiblePopup:', currentVisiblePopup);
            if (currentVisiblePopup) {
                return;
            }
            
            // 更新当前显示的Popup
            currentVisiblePopup = popup as HTMLElement;
            
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

// 初始化并添加事件监听
console.log('开始初始化插件...');
initialize();
console.log('初始化完成');
