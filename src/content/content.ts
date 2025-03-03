import { askAI } from './api';
import { initializeStyles } from "./initial";
import { 
    getTargetNode, 
    findParagraphInsertPosition, 
    createTempContainer, 
    insertTempContainer, 
    replaceWithTranslatedNode, 
    addUnderlineWithPopup, 
    isEntireParagraphSelected, 
    showPopup 
} from "./dom";
import { 
    isChineseText, 
} from './utils';
import { 
    getTranslatedHTML, 
    createTranslationDiv,
    createExplanationDiv,
    createOriginalDiv,
    createPlayButton,
    handleTranslationUpdate,
    handleExplanationStream
} from './helpers';  

// 跟踪当前显示的悬浮窗
let currentVisiblePopup: HTMLElement | null = null;

// 跟踪上一次按C键的时间
let lastCKeyPressTime = 0;

// 将选中文本复制到剪贴板
async function copyToClipboard(text: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('scrollY', window.scrollY.toString());
    url.searchParams.set('text', encodeURIComponent(text));
    const data = {
        text,
        url: url.toString()
    };
    
    try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        console.log('成功复制到剪贴板:', data);
    } catch (err) {
        console.error('复制到剪贴板失败:', err);
    }
}

// 初始化函数
async function initialize() {
    try {    
        const url = new URL(window.location.href);
        const scrollY = url.searchParams.get('scrollY');
        const encodedText = url.searchParams.get('text');
        if (encodedText) {
            const decodedText = decodeURIComponent(encodedText);
            console.log('从 URL 恢复的文本:', decodedText);
            
            // 添加CSS样式
            const style = document.createElement('style');
            style.textContent = `
                @keyframes highlight-flash {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: rgba(105, 46, 231, 0.5); }
                }
                .highlight-animation {
                    display: inline-block;
                    padding: 0 6px;
                    margin: 0 -6px;
                    border-radius: 4px;
                    animation: highlight-flash 1.5s ease-in-out 2;
                }
            `;
            document.head.appendChild(style);

            // 等待滚动完成后查找并高亮文本
            setTimeout(() => {
                // 使用 TreeWalker 遍历 DOM 树查找文本节点
                const treeWalker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: function(node) {
                            return node.textContent?.includes(decodedText)
                                ? NodeFilter.FILTER_ACCEPT
                                : NodeFilter.FILTER_REJECT;
                        }
                    }
                );

                let currentNode;
                while (currentNode = treeWalker.nextNode()) {
                    const range = document.createRange();
                    range.selectNode(currentNode);
                    const rect = range.getBoundingClientRect();
                    
                    // 检查元素是否在可视区域内
                    if (rect.top >= 0 &&
                        rect.left >= 0 &&
                        rect.bottom <= window.innerHeight &&
                        rect.right <= window.innerWidth) {
                        
                        // 创建 span 包裹匹配文本
                        const span = document.createElement('span');
                        span.textContent = currentNode.textContent;
                        currentNode.parentNode?.replaceChild(span, currentNode);
                        
                        // 添加动画类
                        span.classList.add('highlight-animation');
                        
                        // 动画结束后移除类
                        span.addEventListener('animationend', () => {
                            // span.classList.remove('highlight-animation');
                        });
                        
                        break; // 只高亮第一个匹配的可见元素
                    }
                }
            }, 1000); // 给滚动动画留出足够时间
        }
        
        if (scrollY) {
            window.scrollTo({
                top: parseInt(scrollY),
                behavior: 'smooth'
            });
        }

        initializeStyles();
        
        // 监听键盘事件
        document.addEventListener('keydown', (e) => {
            console.log('检测到键盘事件:', e.key);
            
            // 处理T键事件
            if (e.key.toLowerCase() === 't') {
                console.log('检测到按键T');
                const selection = window.getSelection();
                if (!selection || !selection.toString().trim()) {
                    console.log('没有选中文本');
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                console.log('检测到按键T，处理选中文本:', selection.toString().trim());
                processSelection(selection);
            }
            
            // 处理C键事件
            if (e.key.toLowerCase() === 'c') {
                const currentTime = Date.now();
                console.log('currentTime:', currentTime);
                console.log('lastCKeyPressTime:', lastCKeyPressTime);
                if (currentTime - lastCKeyPressTime <= 500) { // 500ms内连续按两次
                    const selection = window.getSelection();
                    if (selection && selection.toString().trim()) {
                        e.preventDefault();
                        e.stopPropagation();
                        copyToClipboard(selection.toString().trim());
                    }
                }
                lastCKeyPressTime = currentTime;
            }
        }, true);
        
        console.log('翻译插件初始化完成');
    } catch (error) {
        console.error('初始化插件时出错:', error);
    }
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

    console.log('startContainer:', range.startContainer.nodeType);
    const targetNode = getTargetNode(range, selectedText);

    console.log('targetNode:', targetNode);

    if (!targetNode) {
        console.log('未找到选中文本所在元素');
        return;
    }

    // 获取包含选中文本的段落节点
    const paragraphNode = targetNode.closest('p') || targetNode;
    const fullParagraphText = paragraphNode.textContent || '';
    console.log('整个段落的文本内容:', fullParagraphText);

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
        await translatePartialText(selectedText, x, y, range, fullParagraphText);
    }
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

// 处理部分文本的翻译
async function translatePartialText(selectedText: string, x: number, y: number, range: Range, fullParagraphText: string) {
    console.log('开始翻译部分文本:', selectedText, '位置:', x, y);
    
    try {
        const popupId = `comfy-trans-popup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // 1. 创建悬浮窗popup，并且更新当前显示的弹窗为popup
        const popup = showPopup(selectedText, x, y, popupId);
        currentVisiblePopup = popup;
        const content = popup.querySelector('.comfy-trans-content') as HTMLElement;
        content.innerHTML = '';

        // 2. 创建翻译的div并插入
        const translationDiv = createTranslationDiv();
        content.appendChild(translationDiv);

        // 3. 创建解释的div并插入
        const explanationDiv = createExplanationDiv();
        content.appendChild(explanationDiv);

        // 4. 创建原文的div并插入
        const { originalDiv, originalText } = createOriginalDiv(selectedText);
        content.insertBefore(originalDiv, content.firstChild);

        // 5. 创建播放按钮并插入到原文div中
        const playButton = createPlayButton(selectedText);
        originalDiv.appendChild(playButton);

        // 6. 发起翻译请求并处理结果
        const translationPromise = askAI(`${fullParagraphText}这个句子中的「${selectedText}」翻译成中文。要求你只输出「${selectedText}」对应的中文翻译结果就好，不要输出任何其他内容。`);
        handleTranslationUpdate(translationDiv, originalText, selectedText, translationPromise);

        // 7. 获取解释并流式更新
        handleExplanationStream(explanationDiv, popup, selectedText, await translationPromise);

        // 8. 为选中文本添加下划线并创建带有悬浮提示的span
        addUnderlineWithPopup(range, selectedText, popupId);
    } catch (error) {
        console.error('翻译过程中出错:', error);
        alert('翻译失败，请查看控制台获取详细错误信息');
    }
}

// 初始化并添加事件监听
console.log('开始初始化插件...');
initialize();
console.log('初始化完成');
