'use client';

import { useModelStore } from '@/lib/stores/modelStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, BrainCircuit } from 'lucide-react';

export function ModelSelector() {
  const { selectedTier, setTier } = useModelStore();

  return (
    <div className="flex flex-col gap-1 w-full px-2 mb-4">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Model</span>
      <Select value={selectedTier} onValueChange={(val: any) => setTier(val)}>
        <SelectTrigger className="w-full h-9 bg-background">
          <SelectValue placeholder="Select Model Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fast">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>Fast & Cheap (0.5x)</span>
            </div>
          </SelectItem>
          <SelectItem value="default">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-blue-500" />
              <span>Balanced (1.0x)</span>
            </div>
          </SelectItem>
          <SelectItem value="smart">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-500" />
              <span>Smart & Precise (2.0x)</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
