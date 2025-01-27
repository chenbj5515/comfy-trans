// 添加以下辅助函数
export function isChineseText(text: string): boolean {
    // 检测是否包含中文特有的标点符号
    const chinesePunctuation = /[\u3000-\u303F]|[\uFF00-\uFFEF]/;

    // 检测是否只包含汉字、中文标点和常用符号
    const chineseOnly = /^[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF\s，。！？、：；""''（）]+$/;

    // 检测是否包含日文特有的假名字符
    const hasJapanese = /[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF66-\uFF9F]/;

    // 如果包含假名，则不认为是中文
    if (hasJapanese.test(text)) {
        return false;
    }

    // 如果包含中文标点且只包含汉字和中文标点，则认为是中文
    return chinesePunctuation.test(text) && chineseOnly.test(text);
}

export async function checkBlacklist() {
    try {
        const hostname = window.location.hostname;
        // @ts-ignore
        const result = await chrome.storage.sync.get(['blacklist']);
        const blacklist = result.blacklist || [];
        blacklist.push('japanese-memory-rsc.vercel.app');

        console.log('blacklist', blacklist);

        // 如果在黑名单中就直接返回
        if (blacklist.some((domain: string) => hostname === domain || hostname.endsWith('.' + domain))) {
            return true;
        }

        return false;
    } catch (e) {
        console.error('Error:', e);
    }
}