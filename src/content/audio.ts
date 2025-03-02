import {
    SpeechConfig,
    SpeechSynthesizer,
    AudioConfig,
    SpeakerAudioDestination,
} from "microsoft-cognitiveservices-speech-sdk";

export interface SpeakOptions {
    lang: string;
    rate: number;
}

interface IOptions {
    voicerName: string,
}

// 添加一个变量来跟踪最后一次播放的时间
let lastSpeakTime = 0;
// 设置防抖时间间隔（毫秒）
const DEBOUNCE_INTERVAL = 300;

export const speakText = (text: string, options?: IOptions, onFinish?: () => void) => {
    console.log('speakText', text);
    
    // 获取当前时间
    const now = Date.now();
    
    // 如果距离上次播放的时间小于防抖间隔，则忽略此次调用
    if (now - lastSpeakTime < DEBOUNCE_INTERVAL) {
        console.log('忽略重复的speakText调用，间隔太短');
        return;
    }
    
    // 更新最后播放时间
    lastSpeakTime = now;
    
    const speechConfig = SpeechConfig.fromSubscription(
        process.env.NEXT_PUBLIC_SUBSCRIPTION_KEY!,
        process.env.NEXT_PUBLIC_REGION!
    );

    // 判断文本是否为日文
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    // 根据文本语言选择发音人
    const voicerName = isJapanese 
        ? "ja-JP-NanamiNeural"  // 日文发音人
        : "en-US-JennyNeural";  // 英文发音人

    speechConfig.speechSynthesisVoiceName = options?.voicerName || voicerName;
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

    let synthesizer: SpeechSynthesizer | undefined = new SpeechSynthesizer(
        speechConfig,
        audioConfig
    );
    synthesizer.speakTextAsync(text, complete_cb, err_cb);
};
