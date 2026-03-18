export interface BrowserVoiceOption {
  id: string;
  label: string;
  description: string;
  lang: string;
  voice: SpeechSynthesisVoice;
}

export function isBrowserVoice(voiceId: string): boolean {
  return voiceId.startsWith("browser:");
}

export function getBrowserVoices(): BrowserVoiceOption[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  const seen = new Set<string>();
  const enVoices: BrowserVoiceOption[] = [];
  const otherVoices: BrowserVoiceOption[] = [];
  for (const v of voices) {
    const key = v.name;
    if (seen.has(key)) continue;
    seen.add(key);
    const langCode = v.lang.split("-")[0].toUpperCase();
    const region = v.lang.split("-")[1] || "";
    const shortLang = v.lang.startsWith("en")
      ? (v.lang === "en-US" ? "US" : v.lang === "en-GB" ? "UK" : v.lang === "en-AU" ? "AU" : region || langCode)
      : `${langCode}${region ? "-" + region : ""}`;
    const option: BrowserVoiceOption = {
      id: `browser:${v.voiceURI}`,
      label: v.name.replace(/^(Google |Microsoft |Apple )/, "").split(" (")[0].split(" -")[0],
      description: `Free · ${shortLang}${v.localService ? "" : " · Network"}`,
      lang: v.lang,
      voice: v,
    };
    if (v.lang.startsWith("en")) {
      enVoices.push(option);
    } else {
      otherVoices.push(option);
    }
  }
  return [...enVoices, ...otherVoices].slice(0, 12);
}

export function getDefaultBrowserVoice(): BrowserVoiceOption | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const allVoices = window.speechSynthesis.getVoices();
  if (allVoices.length === 0) return null;
  const defaultVoice = allVoices.find(v => v.default) || allVoices[0];
  return {
    id: `browser:${defaultVoice.voiceURI}`,
    label: defaultVoice.name,
    description: "Free",
    lang: defaultVoice.lang,
    voice: defaultVoice,
  };
}

export function findBrowserVoice(voiceId: string): SpeechSynthesisVoice | null {
  if (!isBrowserVoice(voiceId)) return null;
  const uri = voiceId.replace("browser:", "");
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.voiceURI === uri) || null;
}

export interface BrowserTTSCallbacks {
  onStart?: () => void;
  onWordIndex?: (index: number) => void;
  onProgress?: (percent: number) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function browserTTSSpeak(
  text: string,
  voiceId: string,
  rate: number,
  callbacks: BrowserTTSCallbacks
): { pause: () => void; resume: () => void; stop: () => void; setRate: (r: number) => void } {
  if (!isBrowserTTSSupported()) {
    callbacks.onError?.("Browser does not support speech synthesis");
    return { pause: () => {}, resume: () => {}, stop: () => {}, setRate: () => {} };
  }

  browserTTSStop();

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;

  const voice = findBrowserVoice(voiceId);
  if (voice) utterance.voice = voice;
  utterance.rate = rate;
  utterance.pitch = 1;

  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  let charToWordMap: number[] = [];
  let charPos = 0;
  for (let i = 0; i < words.length; i++) {
    const idx = text.indexOf(words[i], charPos);
    if (idx >= 0) {
      for (let c = charPos; c < idx + words[i].length; c++) {
        charToWordMap[c] = i;
      }
      charPos = idx + words[i].length;
    }
  }
  for (let c = charPos; c < text.length; c++) {
    charToWordMap[c] = totalWords - 1;
  }

  utterance.onboundary = (e: SpeechSynthesisEvent) => {
    if (e.name === "word") {
      const charIdx = e.charIndex;
      const wordIdx = charToWordMap[charIdx] ?? Math.min(Math.floor((charIdx / text.length) * totalWords), totalWords - 1);
      callbacks.onWordIndex?.(wordIdx);
      callbacks.onProgress?.((wordIdx / totalWords) * 100);
    }
  };

  utterance.onstart = () => callbacks.onStart?.();

  utterance.onend = () => {
    currentUtterance = null;
    callbacks.onWordIndex?.(totalWords - 1);
    callbacks.onProgress?.(100);
    callbacks.onEnd?.();
  };

  utterance.onerror = (e) => {
    currentUtterance = null;
    if (e.error === "canceled" || e.error === "interrupted") return;
    callbacks.onError?.(e.error || "Browser TTS error");
  };

  synth.speak(utterance);

  return {
    pause: () => synth.pause(),
    resume: () => synth.resume(),
    stop: () => {
      synth.cancel();
      currentUtterance = null;
    },
    setRate: (r: number) => {
      utterance.rate = r;
    },
  };
}

export function browserTTSStop() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

export function isBrowserTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
