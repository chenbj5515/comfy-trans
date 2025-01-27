document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const addDomainBtn = document.getElementById('addDomainBtn');

    // 从存储中加载 API Key
    chrome.storage.sync.get(['apiKey'], function(result) {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
    });

    // 保存 API Key
    saveBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        chrome.storage.sync.set({ apiKey: apiKey }, function() {
            alert('API Key 已保存！');
        });
    });

    console.log('popup.js');

    // 禁用当前域名
    addDomainBtn.addEventListener('click', function() {
        console.log('click');
        // 获取当前标签页的域名
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const url = new URL(tabs[0].url);
            const domain = url.hostname;
            
            // 从存储中获取黑名单列表
            chrome.storage.sync.get(['blacklist'], function(result) {
                const blacklist = result.blacklist || [];
                console.log('blacklist', blacklist);

                // 检查域名是否已在黑名单中
                if (!blacklist.includes(domain)) {
                    blacklist.push(domain);
                    console.log('blacklist', blacklist);
                    // 保存更新后的黑名单
                    chrome.storage.sync.set({ blacklist: blacklist }, function() {
                        alert(`已将 ${domain} 添加到黑名单`);
                    });
                } else {
                    alert(`${domain} 已在黑名单中`);
                }
            });
        });
    });

}); 