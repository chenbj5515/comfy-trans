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

export const speakText = (text: string, options?: IOptions, onFinish?: () => void) => {
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
