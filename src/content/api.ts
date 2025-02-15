export async function askAIStream(input: string, model: string = 'gpt-4-turbo') {
    const apiKey = await getApiKey();
    
    if (!apiKey) {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue("请设置OPENAI API KEY");
                controller.close();
            }
        });

        return {
            [Symbol.asyncIterator]() {
                const reader = stream.getReader();
                return {
                    async next() {
                        try {
                            const { done, value } = await reader.read();
                            if (done) {
                                reader.releaseLock();
                                return { done: true, value: undefined };
                            }
                            return { done: false, value };
                        } catch (e) {
                            reader.releaseLock();
                            throw e;
                        }
                    }
                };
            }
        };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: [{
                role: "user",
                content: input
            }],
            stream: true,
        })
    });

    if (response.status === 401) {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue("OPENAI API KEY格式不正确");
                controller.close();
            }
        });

        return {
            [Symbol.asyncIterator]() {
                const reader = stream.getReader();
                return {
                    async next() {
                        try {
                            const { done, value } = await reader.read();
                            if (done) {
                                reader.releaseLock();
                                return { done: true, value: undefined };
                            }
                            return { done: false, value };
                        } catch (e) {
                            reader.releaseLock();
                            throw e;
                        }
                    }
                };
            }
        };
    }

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const stream = new ReadableStream({
        async start(controller) {
            const reader = response.body?.getReader();
            if (!reader) {
                controller.close();
                return;
            }

            const decoder = new TextDecoder();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonData = line.slice(6);
                            if (jsonData === '[DONE]') continue;

                            try {
                                const data = JSON.parse(jsonData);
                                const content = data.choices[0].delta.content;
                                if (content) {
                                    controller.enqueue(content);
                                }
                            } catch (e) {
                                console.error('解析数据出错:', e);
                            }
                        }
                    }
                }
            } finally {
                controller.close();
                reader.releaseLock();
            }
        }
    });

    // 将 ReadableStream 转换为异步可迭代对象
    return {
        [Symbol.asyncIterator]() {
            const reader = stream.getReader();
            return {
                async next() {
                    try {
                        const { done, value } = await reader.read();
                        if (done) {
                            reader.releaseLock();
                            return { done: true, value: undefined };
                        }
                        return { done: false, value };
                    } catch (e) {
                        reader.releaseLock();
                        throw e;
                    }
                }
            };
        }
    };
}

export async function askAI(prompt: string, model: string = 'gpt-4-turbo'): Promise<string> {
    const apiKey = await getApiKey();
    
    if (!apiKey) {
        return "请设置OPENAI API KEY";
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            stream: false
        })
    });

    if (response.status === 401) {
        return "OPENAI API KEY格式不正确";
    }

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// 获取API Key
async function getApiKey(): Promise<string> {
    return new Promise((resolve) => {
        // @ts-ignore
        chrome.storage.sync.get(['apiKey'], (result: { apiKey?: string }) => {
            console.log('getApiKey result', result);
            resolve(result.apiKey || '');
        });
    });
}