import { askAI } from "./api";

// 存储选中计时器
let selectionTimer: NodeJS.Timeout | null = null;

// 初始化页面上下文
export async function initializePageContext() {
    let pageContext = '';
    const mainContent = document.body.innerText.substring(0, 1000);
    try {
        const response = await askAI(`分析这个网页的主题和上下文: ${mainContent}`, "gpt-3.5-turbo");
        pageContext = response;
        console.log('页面上下文初始化成功:', pageContext);
    } catch (error) {
        console.error('获取页面上下文失败:', error);
    }

    return pageContext;
}

// 初始化样式
export function initializeStyles() {
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
export function listenSelection(processSelection: (selection: Selection, selectedText: string) => void) {
    document.addEventListener('mouseup', handleSelection);
    console.log('事件监听器已添加');

    // 处理选中文本
    async function handleSelection() {
        const selection = window.getSelection();
        if (!selection) return;
        const selectedText = selection.toString().trim();

        if (!selectedText) return;
        if (selectionTimer) {
            clearTimeout(selectionTimer);
        }

        selectionTimer = setTimeout(async () => {
            await processSelection(selection, selectedText);
        }, 1500);
    }
}

