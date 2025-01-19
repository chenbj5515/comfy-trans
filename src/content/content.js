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
    // 获取页面主要内容
    const mainContent = document.body.innerText.substring(0, 1000); // 限制长度以节省API调用

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // 使用最快的GPT-3.5 Turbo模型
                messages: [{
                    role: "user",
                    content: `分析这个网页的主题和上下文: ${mainContent}`
                }]
            })
        });

        const data = await response.json();
        pageContext = data.choices[0].message.content;
        console.log('页面上下文初始化成功:', pageContext);
    } catch (error) {
        console.error('获取页面上下文失败:', error);
    }
}

// 处理选中文本
async function handleSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    console.log('选中的文本:', selectedText);
    console.debug('当前选区:', selection);

    // 清除之前的计时器
    if (selectionTimer) {
        clearTimeout(selectionTimer);
    }

    if (!selectedText) return;

    // 设置新的计时器，1.5秒后执行翻译
    selectionTimer = setTimeout(async () => {
        // 检查选区是否仍然存在
        if (!selection.rangeCount) {
            console.log('选区已失效');
            console.debug('选区状态:', selection);
            return;
        }

        const range = selection.getRangeAt(0);
        console.debug('选区范围:', range);

        // 获取选中文本的起始和结束容器的共同父元素
        let startContainer = range.startContainer;
        let endContainer = range.endContainer;

        // 如果是文本节点，获取其父元素
        if (startContainer.nodeType === Node.TEXT_NODE) {
            startContainer = startContainer.parentElement;
        }
        if (endContainer.nodeType === Node.TEXT_NODE) {
            endContainer = endContainer.parentElement;
        }

        // 使用起始容器作为目标节点（因为通常选中的文本都在同一个段落内）
        const targetNode = startContainer;

        if (!targetNode) {
            console.log('未找到选中文本所在元素');
            console.debug('起始容器:', startContainer);
            console.debug('结束容器:', endContainer);
            return;
        }

        console.log('找到的选中文本所在元素:', targetNode);
        console.debug('目标节点属性:', targetNode.attributes);

        // 检查是否已有翻译段落
        const existingTranslation = translatedParagraphs.get(targetNode);
        if (existingTranslation) {
            // 获取当前选中文本所在段落的ID
            const paragraphId = targetNode.id;
            const originalText = translationMap.get(paragraphId)?.originalText;

            // 检查选中的文本是否是原文的一部分
            if (originalText && originalText.includes(selectedText)) {
                console.debug('使用现有翻译段落');
                findAndHighlightTranslation(existingTranslation, selectedText, originalText);

                // 获取选中单词/短语的最常见意思和音标
                const meaningResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        messages: [{
                            role: "user",
                            content: `「${selectedText}」这个单词/短语出现在「${originalText}」这个句子中，分析它在这个句子中的意思，并且如果原文是英文给出国际音标，如果是日语给出平假名音标。`
                        }]
                    })
                });

                const meaningData = await meaningResponse.json();
                const meaningText = meaningData.choices[0].message.content;
                console.debug('最常见意思和音标:', meaningText);

                // 添加最常见意思和音标到翻译文本后面
                existingTranslation.innerHTML += `<br><br>${meaningText}`;

                // 添加播放按钮
                const playButton = document.createElement('button');
                playButton.innerText = '播放';
                playButton.onclick = () => {
                    // 根据文本语言自动选择语音设置
                    const isEnglish = /^[a-zA-Z\s.,!?]+$/.test(selectedText);
                    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(selectedText);

                    const options = {
                        lang: isEnglish ? 'en-US' : 'ja-JP',
                        rate: 0.9  // 稍微放慢速度以提高清晰度
                    };

                    console.log('开始播放语音', selectedText, options);
                    speakText(selectedText, options);
                };
                existingTranslation.appendChild(playButton);

                // 取消选中状态
                selection.removeAllRanges();

                return;
            } else {
                existingTranslation.innerHTML = '正在翻译...';
                console.log('清空已存在的翻译段落');
            }
        }

        // 创建新的翻译段落
        const translatedParagraph = document.createElement('p');
        translatedParagraph.className = 'translation-paragraph';
        translatedParagraph.style.cssText = window.getComputedStyle(targetNode).cssText;
        translatedParagraph.innerHTML = '正在翻译...';

        // 插入DOM元素
        translatedParagraphs.set(targetNode, translatedParagraph);
        targetNode.insertAdjacentElement('afterend', translatedParagraph);
        console.debug('创建的翻译段落:', translatedParagraph);

        // 获取翻译
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

                // 解析流式返回的数据
                const chunk = new TextDecoder().decode(value);
                console.debug('收到数据块:', chunk);
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
                                console.debug('当前翻译文本:', translationText);
                            }
                        } catch (e) {
                            console.log('解析数据出错:', e);
                            console.debug('出错的数据行:', line);
                            continue;
                        }
                    }
                }
            }

            console.log('翻译完成');
            console.debug('最终翻译结果:', translationText);

            // 记录选中的文本和翻译
            translationMap.set(targetNode.id, {
                originalText: selectedText,
                translationText: translationText
            });
        } catch (error) {
            console.error('翻译失败:', error);
            console.debug('错误详情:', error.stack);
            translatedParagraph.innerHTML = '翻译失败，请重试';
        }

    }, 1500); // 1.5秒延迟
}

// 查找并高亮翻译文本
async function findAndHighlightTranslation(translationParagraph, selectedText, originalText) {
    console.log('开始查找对应翻译');
    console.debug('翻译段落:', translationParagraph);
    console.debug('选中文本:', selectedText);
    console.debug('原始文本:', originalText);

    // 移除现有高亮
    const existingHighlights = translationParagraph.querySelectorAll('.highlighted');
    existingHighlights.forEach(el => {
        el.classList.remove('highlighted');
    });

    try {
        // 保存纯文本内容用于后续处理
        const translationText = translationParagraph.textContent;
        console.debug('翻译文本:', translationText);

        // 查找对应翻译
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // 使用最新的GPT-4 Preview模型
                messages: [{
                    role: "user",
                    content: `「${translationText}」这句话中存在一个词可以完美对应这个词：「${selectedText}」，从前往后找，输出这个词，注意只输出这个词不要输出其他词。`
                }]
            })
        });

        const data = await response.json();
        const matchedText = data.choices[0].message.content;

        console.debug('matchedText:', matchedText);

        if (matchedText) {
            const escapedMatchedText = escapeRegExp(matchedText);
            const regex = new RegExp(escapedMatchedText);
            const match = translationText.match(regex);
            console.debug('正则匹配:', {
                pattern: regex,
                result: match
            });

            if (match) {
                const startIndex = match.index;
                const beforeText = translationText.slice(0, startIndex);
                const afterText = translationText.slice(startIndex + matchedText.length);

                translationParagraph.innerHTML = beforeText +
                    `<span class="highlighted">${matchedText}</span>` +
                    afterText;
                console.debug('高亮后的HTML:', translationParagraph.innerHTML);
            } else {
                console.log('未找到匹配的翻译部分');
                console.debug('匹配失败详情:', {
                    translationText,
                    matchedText,
                    regex
                });
            }
        } else {
            console.log('未找到匹配的翻译部分');
            console.debug('API返回数据:', data);
        }
    } catch (error) {
        console.error('查找对应翻译失败:', error);
        console.debug('错误堆栈:', error.stack);
    }
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 添加样式
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
`;
document.head.appendChild(style);

// 初始化并添加事件监听
console.log('开始初始化插件...');
console.debug('当前环境:', {
    url: window.location.href,
    userAgent: navigator.userAgent
});
initialize();
document.addEventListener('mouseup', handleSelection);
console.log('事件监听器已添加');
console.debug('初始化完成');

function speakText(text, options, onFinish) {
    const speechConfig = SpeechConfig.fromSubscription(
        process.env.NEXT_PUBLIC_SUBSCRIPTION_KEY,
        process.env.NEXT_PUBLIC_REGION
    );
    const { lang } = options;

    speechConfig.speechSynthesisVoiceName = lang === 'en-US' ? 'en-US-AriaNeural' : 'ja-JP-NanamiNeural';
    speechConfig.speechSynthesisOutputFormat = 8;
    const complete_cb = function () {
        synthesizer?.close();
        synthesizer = undefined;
    };
    const err_cb = function () {
        synthesizer?.close();
    };

    const player = new SpeakerAudioDestination();

    player.onAudioEnd = () => {
        synthesizer?.close();
        synthesizer = undefined;
        onFinish?.();
    };

    const audioConfig = AudioConfig.fromSpeakerOutput(player);

    let synthesizer = new SpeechSynthesizer(
        speechConfig,
        audioConfig
    );
    synthesizer.speakTextAsync(text, complete_cb, err_cb);
}
