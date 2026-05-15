import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_BASE_URL,
  DEFAULT_API_KEY,
  DEFAULT_MODEL,
} from '@/lib/ai/defaults';

export type EffectiveAiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type State = {
  useCustom: boolean;
  customBaseUrl: string;
  customApiKey: string;
  customModel: string;
  setUseCustom: (b: boolean) => void;
  setCustomBaseUrl: (s: string) => void;
  setCustomApiKey: (s: string) => void;
  setCustomModel: (s: string) => void;
  /**
   * Returns the config the AI client should actually use. When the
   * "custom" toggle is off (or any required field is blank), falls back
   * to the bundled defaults — defaults are never exposed via this getter
   * to the UI, only to the AI client.
   */
  getEffective: () => EffectiveAiConfig;
};

export const useAiConfig = create<State>()(
  persist(
    (set, get) => ({
      useCustom: false,
      customBaseUrl: '',
      customApiKey: '',
      customModel: '',
      setUseCustom: b => set({ useCustom: b }),
      setCustomBaseUrl: s => set({ customBaseUrl: s.trim() }),
      setCustomApiKey: s => set({ customApiKey: s.trim() }),
      setCustomModel: s => set({ customModel: s.trim() }),
      getEffective: () => {
        const s = get();
        // Custom mode: base URL + model are required; key may be empty (the
        // user's own proxy might auth by other means, just like our built-in
        // one does by Origin).
        if (s.useCustom && s.customBaseUrl && s.customModel) {
          return {
            baseUrl: s.customBaseUrl,
            apiKey: s.customApiKey,
            model: s.customModel,
          };
        }
        return {
          baseUrl: DEFAULT_BASE_URL,
          apiKey: DEFAULT_API_KEY,
          model: DEFAULT_MODEL,
        };
      },
    }),
    {
      name: 'glass-start:ai-config',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        useCustom: state.useCustom,
        customBaseUrl: state.customBaseUrl,
        customApiKey: state.customApiKey,
        customModel: state.customModel,
      }),
    }
  )
);
