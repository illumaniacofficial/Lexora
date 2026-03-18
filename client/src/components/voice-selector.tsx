import { useState, useEffect } from "react";
import { ChevronDown, Volume2, Zap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { VOICE_OPTIONS } from "@/components/audio-mini-player";

interface VoiceSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function VoiceSelector({ value, onChange, disabled }: VoiceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(false);

  const selectedVoice = VOICE_OPTIONS.find(v => v.value === value);

  const filteredVoices = VOICE_OPTIONS.filter(voice => {
    const matchesSearch = voice.label.toLowerCase().includes(search.toLowerCase()) || 
                          voice.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !showFreeOnly || voice.isFree;
    return matchesSearch && matchesFilter;
  });

  const freeVoices = filteredVoices.filter(v => v.isFree);
  const premiumVoices = filteredVoices.filter(v => !v.isFree);

  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={cn(
          "w-full px-3 py-2 rounded-lg border border-border/30 bg-card/30 flex items-center justify-between text-left transition-all",
          open && "border-purple-500/40 bg-purple-500/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-testid="button-voice-selector"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
          <span className="font-mono text-sm text-foreground truncate">
            {selectedVoice?.label || "Select voice..."}
          </span>
          {selectedVoice?.isFree && (
            <span className="text-[9px] font-mono text-green-400/60 flex-shrink-0">FREE</span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 w-full bg-card border border-border/30 rounded-lg shadow-lg z-50">
          <div className="p-3 space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="Search voices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 bg-card/30 border-border/30 font-mono text-[12px]"
                data-testid="input-voice-search"
              />
              <button
                onClick={() => setShowFreeOnly(!showFreeOnly)}
                className={cn(
                  "w-full px-2 py-1.5 rounded-lg border border-border/30 text-[11px] font-mono flex items-center justify-center gap-2 transition-all",
                  showFreeOnly && "bg-green-500/10 border-green-500/40 text-green-300"
                )}
                data-testid="button-free-only"
              >
                <Zap className="h-3 w-3" />
                {showFreeOnly ? "Showing Free Only" : "Show Free Only"}
              </button>
            </div>

            {filteredVoices.length === 0 ? (
              <div className="py-4 text-center text-[12px] text-muted-foreground">No voices found</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {premiumVoices.length > 0 && (
                  <div>
                    <div className="text-[9px] font-mono text-muted-foreground/60 px-2 py-1 uppercase tracking-wider">Premium Voices</div>
                    <div className="space-y-1">
                      {premiumVoices.map((voice) => (
                        <button
                          key={voice.value}
                          onClick={() => {
                            onChange(voice.value);
                            setOpen(false);
                            setSearch("");
                          }}
                          className={cn(
                            "w-full text-left px-2 py-2 rounded-lg border border-transparent hover:border-purple-500/40 hover:bg-purple-500/10 transition-all",
                            value === voice.value && "bg-purple-500/20 border-purple-500/40"
                          )}
                          data-testid={`voice-option-${voice.value}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[12px] font-semibold">{voice.label}</span>
                            {value === voice.value && <div className="h-2 w-2 rounded-full bg-purple-400" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">{voice.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {freeVoices.length > 0 && (
                  <div>
                    <div className="text-[9px] font-mono text-green-400/60 px-2 py-1 uppercase tracking-wider">Free Voices</div>
                    <div className="space-y-1">
                      {freeVoices.map((voice) => (
                        <button
                          key={voice.value}
                          onClick={() => {
                            onChange(voice.value);
                            setOpen(false);
                            setSearch("");
                          }}
                          className={cn(
                            "w-full text-left px-2 py-2 rounded-lg border border-transparent hover:border-green-500/40 hover:bg-green-500/5 transition-all",
                            value === voice.value && "bg-green-500/10 border-green-500/40"
                          )}
                          data-testid={`voice-option-${voice.value}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[12px] font-semibold">{voice.label}</span>
                            {value === voice.value && <div className="h-2 w-2 rounded-full bg-green-400" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">{voice.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}
