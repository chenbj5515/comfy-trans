document.getElementById('saveBtn').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value;
    chrome.storage.sync.set({
        'openai_api_key': apiKey
    }, function() {
        alert('API Key已保存！');
    });
});

// 页面加载时读取已保存的API Key
chrome.storage.sync.get(['openai_api_key'], function(result) {
    if (result.openai_api_key) {
        document.getElementById('apiKey').value = result.openai_api_key;
    }
}); 