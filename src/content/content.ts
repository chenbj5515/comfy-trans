import { askAIStream, askAI } from './api';
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
    isJapaneseText, 
    addFuriganaToJapanese, 
    calculateWidthFromCharCount 
} from './utils';
import { speakText } from './audio';
import { getTranslatedHTML } from './helpers';  

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

// 初始化并添加事件监听
console.log('开始初始化插件...');
initialize();
console.log('初始化完成');
