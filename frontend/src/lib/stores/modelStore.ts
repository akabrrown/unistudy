import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ModelTier = 'fast' | 'smart' | 'default';

interface ModelStore {
  selectedTier: ModelTier;
  setTier: (tier: ModelTier) => void;
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      selectedTier: 'default',
      setTier: (tier) => set({ selectedTier: tier }),
    }),
    {
      name: 'unistudy-model-preference',
    }
  )
);
