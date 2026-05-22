import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type EffectiveAiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type State = {
  /** Legacy toggle; ignored by getEffective. Kept so old persisted state
   *  doesn't get migration-noisy. */
  useCustom: boolean;
  customBaseUrl: string;
  customApiKey: string;
  customModel: string;
  setUseCustom: (b: boolean) => void;
  setCustomBaseUrl: (s: string) => void;
  setCustomApiKey: (s: string) => void;
  setCustomModel: (s: string) => void;
  /**
   * Returns the config the AI client should actually use, or `null` when
   * AI is not fully configured. The built-in default endpoint is gone —
   * AI features only work after the user fills in their own base URL +
   * model (key is optional, the user's own proxy may or may not need it).
   */
  getEffective: () => EffectiveAiConfig | null;
  /** Convenience: is AI configured enough to be used? */
  isConfigured: () => boolean;
};

export const useAiConfig = create<State>()(
  persist(
    (set, get) => ({
      useCustom: true, // kept truthy for backwards compat with older callers
      customBaseUrl: '',
      customApiKey: '',
      customModel: '',
      setUseCustom: b => set({ useCustom: b }),
      setCustomBaseUrl: s => set({ customBaseUrl: s.trim() }),
      setCustomApiKey: s => set({ customApiKey: s.trim() }),
      setCustomModel: s => set({ customModel: s.trim() }),
      getEffective: () => {
        const s = get();
        if (!s.customBaseUrl || !s.customModel) return null;
        return {
          baseUrl: s.customBaseUrl,
          apiKey: s.customApiKey,
          model: s.customModel,
        };
      },
      isConfigured: () => {
        const s = get();
        return !!s.customBaseUrl && !!s.customModel;
      },
    }),
    {
      name: 'glass-start:ai-config',
      version: 2,
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
