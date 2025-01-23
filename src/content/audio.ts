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
    const voicerName = options?.voicerName || "ja-JP-NanamiNeural";

    speechConfig.speechSynthesisVoiceName = voicerName;
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
