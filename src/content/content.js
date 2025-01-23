import {
    SpeechConfig,
    SpeechSynthesizer,
    AudioConfig,
    SpeakerAudioDestination,
} from "microsoft-cognitiveservices-speech-sdk";

// 存储页面上下文
let pageContext = '';

// 存储已翻译段落的映射
const translatedParagraphs = new Map();

// 存储选中计时器
let selectionTimer = null;

// 存储选中的文本和翻译的映射
const translationMap = new Map();

// 初始化函数
async function initialize() {
    await initializePageContext();
    initializeStyles();
    initializeEventListeners();
}

// 初始化页面上下文
async function initializePageContext() {
    const mainContent = document.body.innerText.substring(0, 1000);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "user",
                    content: `分析这个网页的主题和上下文: ${mainContent}`
                }],
                stream: true
            })
        });

        pageContext = await processStreamingResponse(response);
        console.log('页面上下文初始化成功:', pageContext);
    } catch (error) {
        console.error('获取页面上下文失败:', error);
    }
}

// 初始化样式
function initializeStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .translation-paragraph {
            margin-top: 10px;
            color: #666;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f9f9f9;
        }
        .highlighted {
            background-color: #333333;
            color: #f6f6f6;
            padding: 4px;
            border-radius: 2px;
        }
        .play-icon {
            display: inline-flex;
            align-items: center;
        }
        .play-icon svg {
            width: 16px;
            height: 16px;
            margin-left: 4px;
        }
    `;
    document.head.appendChild(style);
}

// 初始化事件监听器
function initializeEventListeners() {
    document.addEventListener('mouseup', handleSelection);
    console.log('事件监听器已添加');
}

// 处理选中文本
async function handleSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) return;
    clearExistingTimer();
    setNewSelectionTimer(selection, selectedText);
}

// 清除现有计时器
function clearExistingTimer() {
    if (selectionTimer) {
        clearTimeout(selectionTimer);
    }
}

// 设置新的选择计时器
function setNewSelectionTimer(selection, selectedText) {
    selectionTimer = setTimeout(async () => {
        await processSelection(selection, selectedText);
    }, 1500);
}

// 处理选中的文本
async function processSelection(selection, selectedText) {
    if (!selection.rangeCount) {
        console.log('选区已失效');
        return;
    }

    const range = selection.getRangeAt(0);
    const targetNode = getTargetNode(range);
    
    if (!targetNode) {
        console.log('未找到选中文本所在元素');
        return;
    }

    const existingTranslation = translatedParagraphs.get(targetNode);
    if (existingTranslation) {
        const result = await handleExistingTranslation(existingTranslation, targetNode, selectedText, range, selection);
        if (!result) {
            await createNewTranslation(targetNode, selectedText, range);
        }
    } else {
        await createNewTranslation(targetNode, selectedText, range);
    }
}

// 获取目标节点
function getTargetNode(range) {
    let startContainer = range.startContainer;
    let endContainer = range.endContainer;

    if (startContainer.nodeType === Node.TEXT_NODE) {
        startContainer = startContainer.parentElement;
    }
    if (endContainer.nodeType === Node.TEXT_NODE) {
        endContainer = endContainer.parentElement;
    }

    return startContainer;
}

// 处理已存在的翻译
async function handleExistingTranslation(existingTranslation, targetNode, selectedText, range, selection) {
    const paragraphId = targetNode.id;
    const originalText = translationMap.get(paragraphId)?.originalText;

    if (originalText && originalText.includes(selectedText)) {
        await updateExistingTranslation(existingTranslation, selectedText, originalText, range);
        selection.removeAllRanges();
        return true;
    } else {
        existingTranslation.innerHTML = '正在翻译...';
        return false;
    }
}

// 更新已存在的翻译
async function updateExistingTranslation(existingTranslation, selectedText, originalText, range) {
    addUnderlineToSelection(range);
    findAndHighlightTranslation(existingTranslation, selectedText, originalText);
    
    // 创建含义和音标的容器
    const meaningContainer = document.createElement('div');
    const phoneticContainer = document.createElement('div');
    existingTranslation.appendChild(meaningContainer);
    existingTranslation.appendChild(phoneticContainer);

    // 流式获取含义和音标
    const [meaningResponse, phoneticResponse] = await Promise.all([
        getMeaning(selectedText, originalText),
        getPhonetics(selectedText, originalText)
    ]);

    // 处理流式响应
    const meaningText = await processStreamingResponse(meaningResponse);
    const phoneticText = await processStreamingResponse(phoneticResponse);
    
    appendMeaningAndPhonetics(existingTranslation, selectedText, phoneticText, meaningText);
}

// 为选中文本添加下划线
function addUnderlineToSelection(range) {
    const textNode = range.startContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    
    const beforeText = textNode.textContent.substring(0, startOffset);
    const selectedContent = textNode.textContent.substring(startOffset, endOffset);
    const afterText = textNode.textContent.substring(endOffset);
    
    const span = document.createElement('span');
    span.style.textDecoration = 'underline';
    span.textContent = selectedContent;
    
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(beforeText));
    fragment.appendChild(span);
    fragment.appendChild(document.createTextNode(afterText));
    
    textNode.parentNode.replaceChild(fragment, textNode);
}

// 创建新的翻译
async function createNewTranslation(targetNode, selectedText, range) {
    const insertAfterNode = findInsertPosition(range.startContainer);
    const translatedParagraph = createTranslatedParagraph(targetNode);
    insertTranslatedParagraph(translatedParagraph, insertAfterNode);
    translatedParagraphs.set(targetNode, translatedParagraph); // 添加到映射中
    await translateAndUpdate(translatedParagraph, selectedText, targetNode);
}

// 查找插入位置
function findInsertPosition(startContainer) {
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
function createTranslatedParagraph(targetNode) {
    const translatedParagraph = document.createElement('p');
    translatedParagraph.className = 'translation-paragraph';
    translatedParagraph.style.cssText = window.getComputedStyle(targetNode).cssText;
    translatedParagraph.innerHTML = '正在翻译...';
    return translatedParagraph;
}

// 插入翻译段落
function insertTranslatedParagraph(translatedParagraph, insertAfterNode) {
    insertAfterNode.parentNode.insertBefore(translatedParagraph, insertAfterNode.nextSibling);
}

// 翻译并更新内容
async function translateAndUpdate(translatedParagraph, selectedText, targetNode) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{
                    role: "user",
                    content: `请将「${selectedText}」翻译成中文。这个文本出现的上下文是: ${pageContext}，考虑这个上下文进行翻译，只输出翻译结果就好，不要输出任何其他内容`
                }],
                stream: true
            })
        });

        const reader = response.body.getReader();
        let translationText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonData = line.slice(6);
                        if (jsonData === '[DONE]') continue;
                        const data = JSON.parse(jsonData);
                        if (data.choices[0].delta.content) {
                            translationText += data.choices[0].delta.content;
                            translatedParagraph.innerHTML = translationText;
                        }
                    } catch (e) {
                        console.log('解析数据出错:', e);
                        continue;
                    }
                }
            }
        }

        translationMap.set(targetNode.id, {
            originalText: selectedText,
            translationText: translationText
        });
    } catch (error) {
        console.error('翻译失败:', error);
        translatedParagraph.innerHTML = '翻译失败，请重试';
    }
}

// 获取流式翻译
async function getStreamingTranslation(selectedText) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: `请将「${selectedText}」翻译成中文。这个文本出现的上下文是: ${pageContext}，考虑这个上下文进行翻译，只输出翻译结果就好，不要输出任何其他内容`
            }],
            stream: true
        })
    });

    return processStreamingResponse(response);
}

// 处理流式响应
async function processStreamingResponse(response) {
    const reader = response.body.getReader();
    let translationText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const jsonData = line.slice(6);
                    if (jsonData === '[DONE]') continue;
                    const data = JSON.parse(jsonData);
                    if (data.choices[0].delta.content) {
                        translationText += data.choices[0].delta.content;
                    }
                } catch (e) {
                    console.log('解析数据出错:', e);
                    continue;
                }
            }
        }
    }

    return translationText;
}

// 获取单词含义
async function getMeaning(selectedText, originalText) {
    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: `「${selectedText}」这个单词/短语出现在「${originalText}」这个句子中，分析它在这个句子中的意思`
            }],
            stream: true
        })
    });
}

// 获取音标
async function getPhonetics(selectedText, originalText) {
    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: `「${selectedText}」这个单词/短语出现在「${originalText}」这个句子中，给出它的音标，如果是日文给平假名音标，如果是英文给国际音标，除了音标不要任何其他内容`
            }],
            stream: true
        })
    });
}

// 添加含义和音标到翻译中
function appendMeaningAndPhonetics(translationParagraph, selectedText, phoneticText, meaningText) {
    translationParagraph.innerHTML += `<br><br>
        <div class="selected-text">
            <div style="display: flex; align-items: center; white-space: nowrap;">${selectedText}(${phoneticText})
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    height="20"
                    width="24"
                    class="playbtn"
                >
                    <path
                        clipRule="evenodd"
                        d="M11.26 3.691A1.2 1.2 0 0 1 12 4.8v14.4a1.199 1.199 0 0 1-2.048.848L5.503 15.6H2.4a1.2 1.2 0 0 1-1.2-1.2V9.6a1.2 1.2 0 0 1 1.2-1.2h3.103l4.449-4.448a1.2 1.2 0 0 1 1.308-.26Zm6.328-.176a1.2 1.2 0 0 1 1.697 0A11.967 11.967 0 0 1 22.8 12a11.966 11.966 0 0 1-3.515 8.485 1.2 1.2 0 0 1-1.697-1.697A9.563 9.563 0 0 0 20.4 12a9.565 9.565 0 0 0-2.812-6.788 1.2 1.2 0 0 1 0-1.697Zm-3.394 3.393a1.2 1.2 0 0 1 1.698 0A7.178 7.178 0 0 1 18 12a7.18 7.18 0 0 1-2.108 5.092 1.2 1.2 0 1 1-1.698-1.698A4.782 4.782 0 0 0 15.6 12a4.78 4.78 0 0 0-1.406-3.394 1.2 1.2 0 0 1 0-1.698Z"
                        fillRule="evenodd"
                    ></path>
                </svg>
            </div>
            <div>${meaningText}</div>
        </div>
    `;

    const playButton = translationParagraph.querySelector('.playbtn');
    setupPlayButton(playButton, selectedText);
}

// 设置播放按钮
function setupPlayButton(playButton, selectedText) {
    playButton.onclick = () => {
        const isEnglish = /^[a-zA-Z\s.,!?]+$/.test(selectedText);
        const options = {
            lang: isEnglish ? 'en-US' : 'ja-JP',
            rate: 0.9
        };
        speakText(selectedText, options);
    };
}

// 查找并高亮翻译文本
async function findAndHighlightTranslation(translationParagraph, selectedText, originalText) {
    removeExistingHighlights(translationParagraph);
    const translationText = translationParagraph.textContent;
    
    try {
        const response = await findMatchingTranslation(selectedText, translationText);
        const matchedText = await processStreamingResponse(response);
        if (matchedText) {
            highlightMatchedText(translationParagraph, matchedText, translationText);
        }
    } catch (error) {
        console.error('查找对应翻译失败:', error);
    }
}

// 移除现有高亮
function removeExistingHighlights(translationParagraph) {
    const existingHighlights = translationParagraph.querySelectorAll('.highlighted');
    existingHighlights.forEach(el => {
        el.classList.remove('highlighted');
    });
}

// 查找匹配的翻译
async function findMatchingTranslation(selectedText, translationText) {
    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: `「${translationText}」这句话中存在一个词可以完美对应这个词：「${selectedText}」，从前往后找，输出这个词，注意只输出这个词不要输出其他词。`
            }],
            stream: true
        })
    });
}

// 高亮匹配的文本
function highlightMatchedText(translationParagraph, matchedText, translationText) {
    const escapedMatchedText = escapeRegExp(matchedText);
    const regex = new RegExp(escapedMatchedText);
    const match = translationText.match(regex);

    if (match) {
        const startIndex = match.index;
        const beforeText = translationText.slice(0, startIndex);
        const afterText = translationText.slice(startIndex + matchedText.length);

        translationParagraph.innerHTML = beforeText +
            `<span class="highlighted">${matchedText}</span>` +
            afterText;
    }
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 语音合成函数
function speakText(text, options, onFinish) {
    const speechConfig = SpeechConfig.fromSubscription(
        process.env.NEXT_PUBLIC_SUBSCRIPTION_KEY,
        process.env.NEXT_PUBLIC_REGION
    );
    const { lang } = options;

    speechConfig.speechSynthesisVoiceName = lang === 'en-US' ? 'en-US-AriaNeural' : 'ja-JP-NanamiNeural';
    speechConfig.speechSynthesisOutputFormat = 8;
    
    const player = new SpeakerAudioDestination();
    player.onAudioEnd = () => {
        synthesizer?.close();
        synthesizer = undefined;
        onFinish?.();
    };

    const audioConfig = AudioConfig.fromSpeakerOutput(player);
    let synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);
    
    synthesizer.speakTextAsync(
        text,
        () => {
            synthesizer?.close();
            synthesizer = undefined;
        },
        () => {
            synthesizer?.close();
        }
    );
}

// 初始化并添加事件监听
console.log('开始初始化插件...');
initialize();
console.log('初始化完成');
