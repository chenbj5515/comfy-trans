document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const addDomainBtn = document.getElementById('addDomainBtn');

    // 设置保存按钮的样式，确保文字居中，同时为后续绝对定位做准备
    saveBtn.style.position = 'relative';
    saveBtn.style.textAlign = 'center';
    const btnText = saveBtn.textContent.trim();
    // 使用一个 span 包裹按钮文字，并设为相对定位（便于绝对定位对号）
    saveBtn.innerHTML = `<span class="btn-text" style="position: relative; display:inline-block;">${btnText}</span>`;

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
            // 保存成功后，在按钮文字左侧显示一个 SVG 对号
            const btnTextElem = saveBtn.querySelector('.btn-text');
            if (btnTextElem) {
                // 创建一个元素用于放置对号
                const checkIcon = document.createElement('span');
                checkIcon.className = 'check-icon';
                checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="vertical-align: middle;" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                // 绝对定位到 btn-text 内，left 设为 -20px，使对号贴近文字，可根据需要调整
                checkIcon.style.position = 'absolute';
                checkIcon.style.left = '-20px';
                checkIcon.style.top = '50%';
                checkIcon.style.transform = 'translateY(-50%)';
                checkIcon.style.opacity = '0';
                checkIcon.style.transition = 'opacity 0.3s';

                // 插入对号到 btn-text 内（不会干扰文本的排版）
                btnTextElem.appendChild(checkIcon);
                // 强制重绘以确保 transition 生效
                void checkIcon.offsetWidth;
                // 渐变显示
                checkIcon.style.opacity = '1';
                // 2秒后渐变隐藏，再移除该元素
                setTimeout(() => {
                    checkIcon.style.opacity = '0';
                    setTimeout(() => {
                        if (btnTextElem.contains(checkIcon)) {
                            btnTextElem.removeChild(checkIcon);
                        }
                    }, 300);
                }, 2000);
            }
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