import { askAIStream, askAI } from './api';
import { InsertPosition } from './types';
import { initializeStyles } from "./initial";
import { createTranslatedParagraph, findInsertPosition, getTargetNode, insertTranslatedParagraph, appendLexicalUnit, addUnderlineToSelection } from "./dom";
import { checkBlacklist, isChineseText } from './utils';
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

// 存储页面上下文
let pageContext = '';

// 跟踪当前显示的悬浮窗
let currentVisibleTooltip: HTMLElement | null = null;
let currentVisiblePopup: HTMLElement | null = null;

// 初始化函数
async function initialize() {
    try {
        const isBlacklist = await checkBlacklist();
        console.log('isBlacklist', isBlacklist);
        if (isBlacklist) {
            return;
        }
        
        console.log('初始化翻译插件...');
        pageContext = document.body.innerText.slice(0, 500); // 获取页面前1000个字符作为上下文
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
        
        // 添加全局点击事件监听器，用于关闭所有悬浮窗
        document.addEventListener('click', (e) => {
            console.log('initialize中的全局点击事件被触发，点击的元素:', e.target);
            const tooltips = document.querySelectorAll('.comfy-trans-tooltip');
            console.log('当前页面上的悬浮窗数量:', tooltips.length);
            
            tooltips.forEach((tooltip) => {
                const tooltipElement = tooltip as HTMLElement;
                console.log('检查悬浮窗:', tooltipElement.id, '当前显示状态:', tooltipElement.style.display);
                
                // 检查点击的元素是否在tooltip内部
                let isInsideTooltip = false;
                let target = e.target as Node;
                
                // 检查点击的元素或其祖先元素是否是tooltip
                while (target && target !== document.body) {
                    if (target === tooltipElement) {
                        isInsideTooltip = true;
                        break;
                    }
                    if (target.parentNode) {
                        target = target.parentNode;
                    } else {
                        break;
                    }
                }
                
                // 如果点击的不是tooltip内部元素，则关闭tooltip
                if (tooltipElement.style.display === 'block' && !isInsideTooltip) {
                    console.log('initialize中的全局点击事件：点击发生在悬浮窗外部，关闭悬浮窗', tooltipElement.id);
                    tooltipElement.style.opacity = '0';
                    tooltipElement.style.display = 'none';
                    
                    // 如果关闭的是当前显示的tooltip，重置全局变量
                    if (currentVisibleTooltip === tooltipElement) {
                        currentVisibleTooltip = null;
                    }
                } else if (tooltipElement.style.display === 'block') {
                    console.log('initialize中的全局点击事件：点击发生在悬浮窗内部，不关闭悬浮窗', tooltipElement.id);
                }
            });
            
            // 检查弹窗
            const popup = document.getElementById('comfy-trans-popup');
            if (popup) {
                // 检查点击的元素是否在popup内部
                let isInsidePopup = false;
                let target = e.target as Node;
                
                // 检查点击的元素或其祖先元素是否是popup
                while (target && target !== document.body) {
                    if (target === popup) {
                        isInsidePopup = true;
                        break;
                    }
                    if (target.parentNode) {
                        target = target.parentNode;
                    } else {
                        break;
                    }
                }
                
                // 如果点击的不是popup内部元素，则关闭popup
                if (popup.style.display === 'block' && !isInsidePopup) {
                    console.log('initialize中的全局点击事件：点击发生在弹窗外部，关闭弹窗');
                    popup.style.opacity = '0';
                    popup.style.display = 'none';
                    
                    // 重置全局变量
                    if (currentVisiblePopup === popup) {
                        currentVisiblePopup = null;
                    }
                }
            }
        });
        
        // 添加测试按钮，方便调试
        const testButton = document.createElement('button');
        testButton.textContent = '测试翻译';
        testButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10001;
            padding: 10px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        testButton.addEventListener('click', () => {
            console.log('点击测试按钮');
            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
                console.log('处理选中文本:', selection.toString().trim());
                processSelection(selection);
            } else {
                alert('请先选中文本再点击测试按钮');
            }
        });
        document.body.appendChild(testButton);
        console.log('添加测试按钮');
        
        console.log('翻译插件初始化完成');
    } catch (error) {
        console.error('初始化插件时出错:', error);
    }
}

// 创建弹窗
function createPopup(): HTMLElement {
    console.log('调用createPopup函数');
    // 检查是否已存在弹窗
    let popup = document.getElementById('comfy-trans-popup');
    if (popup) {
        console.log('找到已存在的弹窗，返回');
        // 确保弹窗可见
        popup.style.display = 'block';
        popup.style.opacity = '1';
        popup.style.visibility = 'visible';
        
        // 隐藏当前显示的tooltip（如果有）
        if (currentVisibleTooltip && currentVisibleTooltip !== popup) {
            currentVisibleTooltip.style.display = 'none';
            currentVisibleTooltip.style.opacity = '0';
            console.log('隐藏之前显示的tooltip:', currentVisibleTooltip.id);
        }
        
        // 更新当前显示的弹窗
        currentVisiblePopup = popup as HTMLElement;
        return popup;
    }

    console.log('创建新弹窗');
    // 创建弹窗元素
    popup = document.createElement('div');
    popup.id = 'comfy-trans-popup';
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
function showPopup(text: string, x: number, y: number): HTMLElement {
    console.log('调用showPopup函数，文本:', text, '位置:', x, y);
    const popup = createPopup();
    
    // 隐藏当前显示的tooltip（如果有）
    if (currentVisibleTooltip && currentVisibleTooltip !== popup) {
        currentVisibleTooltip.style.display = 'none';
        currentVisibleTooltip.style.opacity = '0';
        console.log('隐藏之前显示的tooltip:', currentVisibleTooltip.id);
    }
    
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

// 创建悬浮提示
function createTooltip(text: string, translationText: string, explanationText: string = ''): HTMLElement {
    // 检查是否已存在相同内容的tooltip
    const existingTooltips = document.querySelectorAll('.comfy-trans-tooltip');
    for (let i = 0; i < existingTooltips.length; i++) {
        const tooltip = existingTooltips[i] as HTMLElement;
        const originalEl = tooltip.querySelector('.comfy-trans-original');
        if (originalEl && originalEl.textContent === text) {
            return tooltip;
        }
    }

    console.log('创建新的tooltip，文本:', text, '翻译:', translationText, '分析:', explanationText);
    const tooltip = document.createElement('div');
    tooltip.className = 'comfy-trans-tooltip';
    tooltip.id = 'tooltip-' + Math.random().toString(36).substring(2, 15);
    
    // 设置初始定位为absolute
    tooltip.style.position = 'absolute';
    tooltip.style.zIndex = '10000';
    
    // 计算总字符数
    const totalChars = text.length + translationText.length + (explanationText ? explanationText.length : 0);
    console.log('总字符数:', totalChars);
    
    // 根据字符数计算宽度
    const width = calculateWidthFromCharCount(totalChars);
    tooltip.style.maxWidth = `${width}px`;
    tooltip.style.width = `${width}px`;
    
    // 设置主题
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDarkMode) {
        tooltip.classList.add('dark-theme');
        tooltip.classList.remove('light-theme');
    } else {
        tooltip.classList.add('light-theme');
        tooltip.classList.remove('dark-theme');
    }
    
    // 创建内容
    const originalText = document.createElement('div');
    originalText.className = 'comfy-trans-original';
    originalText.textContent = text;
    originalText.style.fontWeight = 'bold';
    originalText.style.wordBreak = 'break-word';
    originalText.style.whiteSpace = 'normal';
    originalText.style.fontSize = '14px';
    originalText.style.lineHeight = '1.9';
    originalText.style.cursor = 'pointer';
    originalText.addEventListener('click', (e) => {
        e.stopPropagation();
        speakText(text);
    });
    
    const translationContent = document.createElement('div');
    translationContent.className = 'comfy-trans-translation';
    translationContent.textContent = translationText;
    translationContent.style.borderBottom = isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)';
    translationContent.style.paddingBottom = '8px';
    translationContent.style.marginBottom = '8px';
    translationContent.style.wordBreak = 'break-word';
    translationContent.style.whiteSpace = 'normal';
    translationContent.style.fontSize = '14px';
    translationContent.style.lineHeight = '1.9';
    translationContent.addEventListener('click', (e) => e.stopPropagation());
    
    // 创建播放按钮
    const playButton = document.createElement('div');
    playButton.className = 'comfy-trans-play';
    playButton.style.display = 'flex';
    playButton.style.alignItems = 'center';
    playButton.style.padding = '5px';
    playButton.style.cursor = 'pointer';
    playButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" height="18" width="18" style="cursor: pointer;">
            <path clip-rule="evenodd" fill-rule="evenodd" d="M11.26 3.691A1.2 1.2 0 0 1 12 4.8v14.4a1.199 1.199 0 0 1-2.048.848L5.503 15.6H2.4a1.2 1.2 0 0 1-1.2-1.2V9.6a1.2 1.2 0 0 1 1.2-1.2h3.103l4.449-4.448a1.2 1.2 0 0 1 1.308-.26Z"></path>
        </svg>
    `;
    
    // 添加播放事件
    playButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        speakText(text);
    });
    
    // 组合元素
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.appendChild(originalText);
    header.appendChild(playButton);
    header.addEventListener('click', (e) => e.stopPropagation());
    
    tooltip.appendChild(header);
    tooltip.appendChild(translationContent);
    
    // 添加解释内容（如果有）
    if (explanationText && explanationText.trim() !== '') {
        const explanationContent = document.createElement('div');
        explanationContent.className = 'comfy-trans-explanation';
        explanationContent.innerHTML = explanationText;
        explanationContent.style.fontSize = '14px';
        explanationContent.style.lineHeight = '1.9';
        explanationContent.style.color = isDarkMode ? '#bbb' : '#555';
        explanationContent.style.wordBreak = 'break-word';
        explanationContent.style.whiteSpace = 'normal';
        explanationContent.addEventListener('click', (e) => e.stopPropagation());
        tooltip.appendChild(explanationContent);
        console.log('添加解释内容到tooltip');
    }
    
    // 添加到文档
    document.body.appendChild(tooltip);
    
    // 初始状态为隐藏
    tooltip.style.display = 'none';
    tooltip.style.opacity = '0';
    
    // 如果当前有弹窗或其他tooltip显示，保持新tooltip隐藏
    if (currentVisiblePopup || (currentVisibleTooltip && currentVisibleTooltip !== tooltip)) {
        console.log('当前已有其他悬浮窗显示，保持新tooltip隐藏');
        tooltip.style.display = 'none';
        tooltip.style.opacity = '0';
    }
    
    // 添加全局点击事件监听器，点击tooltip外部区域时关闭tooltip
    const closeTooltipOnOutsideClick = (e: MouseEvent) => {
        if (tooltip.style.display === 'block') {
            // 检查点击的元素是否在tooltip内部
            let isInsideTooltip = false;
            let target = e.target as Node;
            
            // 检查点击的元素或其祖先元素是否是tooltip
            while (target && target !== document.body) {
                if (target === tooltip) {
                    isInsideTooltip = true;
                    break;
                }
                if (target.parentNode) {
                    target = target.parentNode;
                } else {
                    break;
                }
            }
            
            // 如果点击的不是tooltip内部元素，则关闭tooltip
            if (!isInsideTooltip) {
                console.log('createTooltip中的全局点击事件：点击发生在悬浮窗外部，关闭悬浮窗', tooltip.id, '点击的元素:', e.target);
                tooltip.style.display = 'none';
                tooltip.style.opacity = '0';
                
                // 重置全局变量
                if (currentVisibleTooltip === tooltip) {
                    currentVisibleTooltip = null;
                }
            } else {
                console.log('createTooltip中的全局点击事件：点击发生在悬浮窗内部，不关闭悬浮窗', tooltip.id);
            }
        }
    };
    
    // 添加点击事件监听
    document.addEventListener('click', closeTooltipOnOutsideClick);
    
    // 确保tooltip不会因为鼠标离开而关闭
    tooltip.addEventListener('mouseleave', (e) => {
        // 阻止默认行为和事件冒泡
        e.preventDefault();
        e.stopPropagation();
        // 不做任何关闭操作
        console.log('鼠标离开悬浮窗，但不关闭悬浮窗');
    });
    
    return tooltip;
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

    console.log('处理选中文本:', selectedText, '是否为整段:', isFullParagraph, '位置:', x, y);
    console.log('选中文本的矩形区域:', rect);

    if (isFullParagraph) {
        console.log('处理整段翻译');
        // 处理整个段落的翻译
        await translateFullParagraph(targetNode, selectedText, range);
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
async function translateFullParagraph(targetNode: Element, selectedText: string, range: Range) {
    const insertAfterNode = findInsertPosition(targetNode);
    const translatedParagraph = createTranslatedParagraph(targetNode);

    // 根据模式设置样式类
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    translatedParagraph.className = isDarkMode ? 'translation-paragraph dark-theme' : 'translation-paragraph light-theme';

    if (insertAfterNode && insertAfterNode.parentNode) {
        const insertPosition: InsertPosition = {
            parentNode: {
                insertBefore: (node: Node, reference: Node | null) =>
                    insertAfterNode.parentNode!.insertBefore(node, reference)
            },
            nextSibling: insertAfterNode.nextSibling
        };

        insertTranslatedParagraph(translatedParagraph, insertPosition);
        
        // 创建翻译内容的div容器
        const translationDiv = document.createElement('div');
        translationDiv.id = 'translation-content-' + Math.random().toString(36).substring(2, 15);
        translatedParagraph.appendChild(translationDiv);

        const stream = await askAIStream(`请将「${selectedText}」翻译成中文。这个文本出现的上下文是: ${pageContext}，考虑这个上下文进行翻译，只输出翻译结果就好，不要输出任何其他内容`);

        let translationText = '';
        let chunkCount = 0;

        for await (const chunk of stream) {
            if (translationDiv && chunk) {
                translationDiv.innerHTML += chunk;
                translationText += chunk;
                
                // 每接收10个数据块或累积一定字符数后，重新计算宽度
                chunkCount++;
                if (chunkCount % 10 === 0 || translationText.length % 50 === 0) {
                    // 计算总字符数
                    const totalChars = selectedText.length + translationText.length;
                    
                    // 计算宽度
                    const width = calculateWidthFromCharCount(totalChars);
                    
                    // 应用新宽度到翻译段落
                    translatedParagraph.style.width = `${width}px`;
                    translatedParagraph.style.maxWidth = `${width}px`;
                }
            }
        }
    } else {
        console.error('无法找到有效的插入位置');
    }
}

// 处理部分文本的翻译
async function translatePartialText(selectedText: string, x: number, y: number, range: Range) {
    console.log('开始翻译部分文本:', selectedText, '位置:', x, y);
    
    try {
        // 为选中文本添加下划线并创建带有悬浮提示的span
        console.log('添加下划线和悬浮提示');
        const underlinedSpan = addUnderlineWithTooltip(range, selectedText);
        console.log('下划线和悬浮提示添加完成');
        
        // 显示弹窗
        console.log('准备显示弹窗');
        const popup = showPopup(selectedText, x, y);
        console.log('弹窗显示完成，获取内容容器');
        const content = popup.querySelector('.comfy-trans-content') as HTMLElement;
        
        // 更新当前显示的弹窗
        currentVisiblePopup = popup;
        
        // 获取翻译和解释
        console.log('开始获取翻译');
        const translationPromise = askAI(`请将「${selectedText}」翻译成中文。这个文本出现的上下文是: ${pageContext}，考虑这个上下文进行翻译，只输出翻译结果就好，不要输出任何其他内容`);
        
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
        const translation = await translationPromise;
        console.log('获取到翻译结果:', translation);
        translationDiv.textContent = translation;
        
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
                    
                    // 重新计算位置，确保弹窗不超出视窗
                    const popupRect = popup.getBoundingClientRect();
                    // ... 位置调整逻辑 ...
                }
            }
        }
        console.log('解释获取完成');
        
        // 创建tooltip并存储翻译结果和解释
        console.log('创建tooltip并存储翻译结果和解释');
        const tooltip = createTooltip(selectedText, translation, explanation);
        underlinedSpan.dataset.tooltip = tooltip.id;
        console.log('tooltip创建完成，ID:', tooltip.id);
        
        // 隐藏tooltip，因为当前已经显示了弹窗
        tooltip.style.display = 'none';
        tooltip.style.opacity = '0';
        
        // 将tooltip添加到全局变量中，但不显示它
        currentVisibleTooltip = null; // 确保不会被错误地设置为当前显示的tooltip
        
        // 根据字符数调整弹窗宽度
        const totalChars = selectedText.length + translation.length + explanation.length;
        console.log('总字符数:', totalChars);
        
        // 根据字符数计算宽度
        const width = calculateWidthFromCharCount(totalChars);
        popup.style.width = `${width}px`;
        popup.style.maxWidth = `${width}px`;
        
        console.log('弹窗将保持显示，直到用户点击关闭按钮或点击弹窗外部区域');
    } catch (error) {
        console.error('翻译过程中出错:', error);
        alert('翻译失败，请查看控制台获取详细错误信息');
    }
}

// 为选中文本添加下划线并创建带有悬浮提示的span
function addUnderlineWithTooltip(range: Range, selectedText: string): HTMLSpanElement {
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
    
    // 添加鼠标悬停事件
    span.addEventListener('mouseenter', (e) => {
        console.log('鼠标进入下划线文本，事件对象:', e.type, '目标元素:', e.target);
        const tooltipId = span.dataset.tooltip;
        console.log('获取到tooltip ID:', tooltipId);
        
        if (tooltipId) {
            const tooltip = document.getElementById(tooltipId);
            console.log('找到tooltip元素:', tooltip);
            
            if (tooltip) {
                // 如果当前有其他悬浮窗显示，先隐藏它
                if (currentVisiblePopup && currentVisiblePopup.id !== tooltip.id) {
                    currentVisiblePopup.style.display = 'none';
                    currentVisiblePopup.style.opacity = '0';
                    console.log('隐藏当前显示的弹窗:', currentVisiblePopup.id);
                }
                
                // 如果当前有其他tooltip显示，先隐藏它
                if (currentVisibleTooltip && currentVisibleTooltip.id !== tooltip.id) {
                    currentVisibleTooltip.style.display = 'none';
                    currentVisibleTooltip.style.opacity = '0';
                    console.log('隐藏当前显示的tooltip:', currentVisibleTooltip.id);
                }
                
                // 更新当前显示的tooltip
                currentVisibleTooltip = tooltip as HTMLElement;
                
                // 先设置为可见，以便计算尺寸
                tooltip.style.display = 'block';
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
                console.log('设置tooltip为可见，当前状态:', tooltip.style.display, tooltip.style.opacity, tooltip.style.visibility);
                
                // 使用setTimeout确保DOM已更新
                setTimeout(() => {
                    console.log('setTimeout回调执行，重新计算tooltip位置');
                    // 计算位置
                    const rect = span.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    console.log('span位置:', rect);
                    console.log('tooltip尺寸:', tooltipRect);
                    
                    // 检查宽高比
                    const widthHeightRatio = tooltipRect.width / tooltipRect.height;
                    const targetRatio = 368 / 500; // 目标宽高比
                    console.log('当前宽高比:', widthHeightRatio, '目标宽高比:', targetRatio);
                    
                    // 如果宽高比偏离目标太多，调整宽度
                    if (Math.abs(widthHeightRatio - targetRatio) > 0.1) {
                        // 根据当前高度计算理想宽度
                        const idealWidth = Math.round(tooltipRect.height * targetRatio);
                        console.log('调整宽度以接近目标宽高比，理想宽度:', idealWidth);
                        
                        // 限制宽度在合理范围内
                        const finalWidth = Math.max(250, Math.min(400, idealWidth));
                        tooltip.style.width = `${finalWidth}px`;
                        tooltip.style.maxWidth = `${finalWidth}px`;
                        console.log('最终设置的宽度:', finalWidth);
                    }
                    
                    // 将悬浮窗定位在单词的右下角
                    let posX = rect.right;
                    let posY = rect.bottom;
                    console.log('初始计算位置(右下角):', posX, posY);
                    
                    // 检查是否会超出视窗右侧
                    if (posX + tooltipRect.width > window.innerWidth + window.scrollX) {
                        // 如果超出右侧，则显示在左侧
                        posX = rect.left - tooltipRect.width;
                        console.log('调整水平位置，避免超出右侧:', posX);
                    }
                    
                    // 检查是否会超出视窗底部
                    if (posY + tooltipRect.height > window.innerHeight + window.scrollY) {
                        // 如果超出底部，则显示在上方
                        posY = rect.top - tooltipRect.height;
                        console.log('调整垂直位置，避免超出底部:', posY);
                    }
                    
                    // 设置最终位置，使用absolute定位而不是fixed
                    tooltip.style.position = 'absolute';
                    tooltip.style.left = `${posX + window.scrollX}px`;
                    tooltip.style.top = `${posY + window.scrollY}px`;
                    console.log('设置tooltip最终位置:', posX + window.scrollX, posY + window.scrollY, '当前状态:', tooltip.style.display, tooltip.style.opacity);
                }, 0);
            } else {
                console.error('未找到tooltip元素，ID:', tooltipId);
            }
        } else {
            console.log('span没有关联的tooltip ID');
        }
    });
    
    // 添加点击事件，防止点击下划线文本时关闭tooltip
    span.addEventListener('click', (e) => {
        console.log('下划线文本被点击，事件对象:', e.type, '目标元素:', e.target);
        e.stopPropagation();
        
        // 点击下划线文本时发音
        speakText(selectedText);
        
        // 显示对应的tooltip
        const tooltipId = span.dataset.tooltip;
        console.log('获取到tooltip ID:', tooltipId);
        
        if (tooltipId) {
            const tooltip = document.getElementById(tooltipId);
            console.log('找到tooltip元素:', tooltip);
            
            if (tooltip) {
                // 如果当前有其他悬浮窗显示，先隐藏它
                if (currentVisiblePopup && currentVisiblePopup.id !== tooltip.id) {
                    currentVisiblePopup.style.display = 'none';
                    currentVisiblePopup.style.opacity = '0';
                    console.log('隐藏当前显示的弹窗:', currentVisiblePopup.id);
                }
                
                // 如果当前有其他tooltip显示，先隐藏它
                if (currentVisibleTooltip && currentVisibleTooltip.id !== tooltip.id) {
                    currentVisibleTooltip.style.display = 'none';
                    currentVisibleTooltip.style.opacity = '0';
                    console.log('隐藏当前显示的tooltip:', currentVisibleTooltip.id);
                }
                
                // 更新当前显示的tooltip
                currentVisibleTooltip = tooltip as HTMLElement;
                
                tooltip.style.display = 'block';
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
                console.log('设置tooltip为可见，当前状态:', tooltip.style.display, tooltip.style.opacity, tooltip.style.visibility);
                
                // 使用setTimeout确保DOM已更新
                setTimeout(() => {
                    console.log('setTimeout回调执行，重新计算tooltip位置');
                    // 计算位置
                    const rect = span.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    console.log('span位置:', rect);
                    console.log('tooltip尺寸:', tooltipRect);
                    
                    // 检查宽高比
                    const widthHeightRatio = tooltipRect.width / tooltipRect.height;
                    const targetRatio = 368 / 500; // 目标宽高比
                    console.log('当前宽高比:', widthHeightRatio, '目标宽高比:', targetRatio);
                    
                    // 如果宽高比偏离目标太多，调整宽度
                    if (Math.abs(widthHeightRatio - targetRatio) > 0.1) {
                        // 根据当前高度计算理想宽度
                        const idealWidth = Math.round(tooltipRect.height * targetRatio);
                        console.log('调整宽度以接近目标宽高比，理想宽度:', idealWidth);
                        
                        // 限制宽度在合理范围内
                        const finalWidth = Math.max(250, Math.min(400, idealWidth));
                        tooltip.style.width = `${finalWidth}px`;
                        tooltip.style.maxWidth = `${finalWidth}px`;
                        console.log('最终设置的宽度:', finalWidth);
                    }
                    
                    // 将悬浮窗定位在单词的右下角
                    let posX = rect.right;
                    let posY = rect.bottom;
                    console.log('初始计算位置(右下角):', posX, posY);
                    
                    // 检查是否会超出视窗右侧
                    if (posX + tooltipRect.width > window.innerWidth + window.scrollX) {
                        // 如果超出右侧，则显示在左侧
                        posX = rect.left - tooltipRect.width;
                        console.log('调整水平位置，避免超出右侧:', posX);
                    }
                    
                    // 检查是否会超出视窗底部
                    if (posY + tooltipRect.height > window.innerHeight + window.scrollY) {
                        // 如果超出底部，则显示在上方
                        posY = rect.top - tooltipRect.height;
                        console.log('调整垂直位置，避免超出底部:', posY);
                    }
                    
                    // 设置最终位置，使用absolute定位而不是fixed
                    tooltip.style.position = 'absolute';
                    tooltip.style.left = `${posX + window.scrollX}px`;
                    tooltip.style.top = `${posY + window.scrollY}px`;
                    console.log('设置tooltip最终位置:', posX + window.scrollX, posY + window.scrollY, '当前状态:', tooltip.style.display, tooltip.style.opacity);
                }, 0);
            } else {
                console.error('未找到tooltip元素，ID:', tooltipId);
            }
        } else {
            console.log('span没有关联的tooltip ID');
        }
    });
    
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

// 初始化并添加事件监听
console.log('开始初始化插件...');
initialize();
console.log('初始化完成');
