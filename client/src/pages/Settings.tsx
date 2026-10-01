import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, User, Globe, Brain, FileText, Image, Megaphone, Volume2, Store, Download, Zap, Hexagon, AlertCircle, Save, Play, Square, Loader2, Users, LockKeyhole, KeyRound, PlugZap } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, LANGUAGE_LABELS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VERTICALS, LANGUAGES } from "@shared/schema";
import type { AppSettings } from "@shared/schema";
import { VoiceSelector } from "@/components/voice-selector";
import { DEFAULT_VOICE_ID, VOICE_OPTIONS, isFishAudioVoice } from "@/components/audio-mini-player";
import { isBrowserVoice, browserTTSSpeak, browserTTSStop } from "@/lib/browser-tts";

const PREVIEW_SAMPLE = "This is a preview of the selected narrator voice. Lexora brings your books to life with natural, expressive narration.";

const schema = z.object({
  defaultAuthorName: z.string().min(1, "Author name is required").max(200),
  defaultVertical: z.string(),
  defaultLanguage: z.string(),
  aiModel: z.string(),
  chapterWordTarget: z.number().min(500).max(10000),
  autoGenerateCover: z.boolean(),
  autoGenerateMarketing: z.boolean(),
  ttsDefaultVoice: z.string(),
  storefrontTitle: z.string().min(1, "Storefront title is required").max(200),
  exportFormat: z.string(),
});

type FormData = z.infer<typeof schema>;

const aiModelOptions = [
  { value: "fast", label: "Fast (GPT-5 Mini)", desc: "Faster, lower cost" },
  { value: "high", label: "High Quality (GPT-5.1)", desc: "Best quality, higher cost" },
];

const exportFormatOptions = [
  { value: "html", label: "HTML" },
  { value: "txt", label: "Plain Text" },
  { value: "epub", label: "EPUB" },
];

interface BrandKitItem {
  id: number;
  name: string;
  palette: string[] | null;
  fonts: string[] | null;
  logoUrl: string | null;
  isDefault: boolean;
}

function BrandKitManager() {
  const { toast } = useToast();
  const { data: kits, isLoading } = useQuery<BrandKitItem[]>({ queryKey: ["/api/brand-kits"] });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [palette, setPalette] = useState("");
  const [fonts, setFonts] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const reset = () => {
    setEditingId(null); setName(""); setPalette(""); setFonts(""); setLogoUrl(""); setIsDefault(false);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/brand-kits"] });

  const buildPayload = () => ({
    name: name.trim(),
    palette: palette.split(",").map(s => s.trim()).filter(Boolean),
    fonts: fonts.split(",").map(s => s.trim()).filter(Boolean),
    logoUrl: logoUrl.trim() || null,
    isDefault,
  });

  const saveMutation = useMutation({
    mutationFn: () => editingId
      ? apiRequest("PATCH", `/api/brand-kits/${editingId}`, buildPayload())
      : apiRequest("POST", "/api/brand-kits", buildPayload()),
    onSuccess: () => { invalidate(); reset(); toast({ title: editingId ? "Brand kit updated" : "Brand kit created" }); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/brand-kits/${id}`),
    onSuccess: () => { invalidate(); if (editingId) reset(); toast({ title: "Brand kit deleted" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const startEdit = (kit: BrandKitItem) => {
    setEditingId(kit.id);
    setName(kit.name);
    setPalette((kit.palette || []).join(", "));
    setFonts((kit.fonts || []).join(", "));
    setLogoUrl(kit.logoUrl || "");
    setIsDefault(kit.isDefault);
  };

  return (
    <Card className="border-border/20 bg-card/30">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
          <Image className="h-3.5 w-3.5 text-pink-400/70" /> Author Brand Kits
        </CardTitle>
        <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Reusable color palettes, fonts, and logos applied to AI cover generation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (kits && kits.length > 0) ? (
          <div className="space-y-2">
            {kits.map(kit => (
              <div key={kit.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/30 border border-border/20" data-testid={`brand-kit-${kit.id}`}>
                <div className="flex gap-1 shrink-0">
                  {(kit.palette || []).slice(0, 5).map((c, i) => (
                    <span key={i} className="h-5 w-5 rounded-full border border-border/30" style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-bold truncate" data-testid={`text-brand-kit-name-${kit.id}`}>{kit.name}</p>
                    {kit.isDefault && <Badge variant="outline" className="text-[8px] font-mono border-pink-500/30 text-pink-300">DEFAULT</Badge>}
                  </div>
                  {(kit.fonts && kit.fonts.length > 0) && (
                    <p className="text-[9px] font-mono text-muted-foreground/40 truncate">{kit.fonts.join(" · ")}</p>
                  )}
                </div>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] font-mono border-border/30" onClick={() => startEdit(kit)} data-testid={`button-edit-brand-kit-${kit.id}`}>Edit</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0 border-red-500/20 text-red-400 hover:border-red-500/40" onClick={() => deleteMutation.mutate(kit.id)} disabled={deleteMutation.isPending} aria-label="Delete brand kit" data-testid={`button-delete-brand-kit-${kit.id}`}>
                  <AlertCircle className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] font-mono text-muted-foreground/40">No brand kits yet. Create one below.</p>
        )}

        <div className="space-y-3 pt-3 border-t border-border/10">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">{editingId ? "Edit Brand Kit" : "New Brand Kit"}</p>
          <div className="space-y-2">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Kit name (e.g., Thriller Series)" className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="input-brand-kit-name" />
            <Input value={palette} onChange={e => setPalette(e.target.value)} placeholder="Palette colors, comma-separated (e.g., #0B132B, #C9A227)" className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="input-brand-kit-palette" />
            <Input value={fonts} onChange={e => setFonts(e.target.value)} placeholder="Fonts, comma-separated (e.g., Playfair Display, Inter)" className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="input-brand-kit-fonts" />
            <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Logo URL (optional)" className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="input-brand-kit-logo" />
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} data-testid="switch-brand-kit-default" />
              <span className="text-[10px] font-mono text-muted-foreground/50">Set as default kit</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="neon-glow text-white border-0 font-mono text-[11px]" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()} data-testid="button-save-brand-kit">
              {saveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
              {editingId ? "UPDATE" : "CREATE"}
            </Button>
            {editingId && (
              <Button type="button" size="sm" variant="outline" className="font-mono text-[11px] border-border/30" onClick={reset} data-testid="button-cancel-brand-kit">CANCEL</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MembershipTierItem {
  id: number;
  name: string;
  priceUsd: number;
  benefits: string[] | null;
  isActive: boolean;
  stripePriceId: string | null;
}

function MembershipTierManager() {
  const { toast } = useToast();
  const { data: tiers, isLoading } = useQuery<MembershipTierItem[]>({ queryKey: ["/api/membership-tiers"] });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [benefits, setBenefits] = useState("");
  const [isActive, setIsActive] = useState(true);

  const reset = () => { setEditingId(null); setName(""); setPrice(""); setBenefits(""); setIsActive(true); };
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/membership-tiers"] });

  const buildPayload = () => ({
    name: name.trim(),
    priceUsd: parseFloat(price) || 0,
    benefits: benefits.split("\n").map(s => s.trim()).filter(Boolean),
    isActive,
  });

  const saveMutation = useMutation({
    mutationFn: () => editingId
      ? apiRequest("PATCH", `/api/membership-tiers/${editingId}`, buildPayload())
      : apiRequest("POST", "/api/membership-tiers", buildPayload()),
    onSuccess: () => { invalidate(); reset(); toast({ title: editingId ? "Tier updated" : "Tier created" }); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const startEdit = (tier: MembershipTierItem) => {
    setEditingId(tier.id);
    setName(tier.name);
    setPrice(String(tier.priceUsd));
    setBenefits((tier.benefits || []).join("\n"));
    setIsActive(tier.isActive);
  };

  return (
    <Card className="border-border/20 bg-card/30">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
          <Store className="h-3.5 w-3.5 text-purple-400/70" /> Membership Tiers
        </CardTitle>
        <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Recurring subscriptions that unlock all premium books on your storefront</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (tiers && tiers.length > 0) ? (
          <div className="space-y-2">
            {tiers.map(tier => (
              <div key={tier.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/30 border border-border/20" data-testid={`membership-tier-${tier.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-bold truncate" data-testid={`text-tier-name-${tier.id}`}>{tier.name}</p>
                    <Badge variant="outline" className="text-[8px] font-mono border-purple-500/30 text-purple-300">${tier.priceUsd.toFixed(2)}/mo</Badge>
                    {!tier.isActive && <Badge variant="outline" className="text-[8px] font-mono border-stone-500/30 text-stone-400">INACTIVE</Badge>}
                    {!tier.stripePriceId && <Badge variant="outline" className="text-[8px] font-mono border-amber-500/30 text-amber-300">NO STRIPE PRICE</Badge>}
                  </div>
                  {(tier.benefits && tier.benefits.length > 0) && (
                    <p className="text-[9px] font-mono text-muted-foreground/40 truncate">{tier.benefits.join(" · ")}</p>
                  )}
                </div>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] font-mono border-border/30" onClick={() => startEdit(tier)} data-testid={`button-edit-tier-${tier.id}`}>Edit</Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] font-mono text-muted-foreground/40">No membership tiers yet. Create one below.</p>
        )}

        <div className="space-y-3 pt-3 border-t border-border/10">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">{editingId ? "Edit Tier" : "New Tier"}</p>
          <div className="space-y-2">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Tier name (e.g., All-Access)" className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="input-tier-name" />
            <Input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="Monthly price USD (e.g., 9.99)" className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="input-tier-price" />
            <textarea value={benefits} onChange={e => setBenefits(e.target.value)} placeholder="Benefits, one per line" rows={3} className="w-full rounded-md bg-card/30 border border-border/30 font-mono text-[12px] p-2 resize-none" data-testid="input-tier-benefits" />
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-tier-active" />
              <span className="text-[10px] font-mono text-muted-foreground/50">Active (shown to readers)</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="neon-glow text-white border-0 font-mono text-[11px]" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()} data-testid="button-save-tier">
              {saveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
              {editingId ? "UPDATE" : "CREATE"}
            </Button>
            {editingId && (
              <Button type="button" size="sm" variant="outline" className="font-mono text-[11px] border-border/30" onClick={reset} data-testid="button-cancel-tier">CANCEL</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface WorkspaceMemberItem {
  id: number;
  userId: string;
  role: "owner" | "editor" | "viewer";
  username: string;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner — full control, approvals, members" },
  { value: "editor", label: "Editor — write & revise chapters" },
  { value: "viewer", label: "Viewer — read & comment only" },
];

function WorkspaceMemberManager() {
  const { toast } = useToast();
  const { data: members, isLoading } = useQuery<WorkspaceMemberItem[]>({ queryKey: ["/api/workspace/members"] });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("editor");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/workspace/members"] });
  const reset = () => { setUsername(""); setPassword(""); setRole("editor"); };

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/workspace/members", { username: username.trim(), password, role }),
    onSuccess: () => { invalidate(); reset(); toast({ title: "Teammate added" }); },
    onError: (e: any) => toast({ title: "Add failed", description: e.message, variant: "destructive" }),
  });
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => apiRequest("PATCH", `/api/workspace/members/${id}`, { role }),
    onSuccess: () => { invalidate(); toast({ title: "Role updated" }); },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/workspace/members/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Teammate removed" }); },
    onError: (e: any) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-border/20 bg-card/30">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-purple-400/70" /> Team Workspace
        </CardTitle>
        <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Invite teammates and control who can edit, approve, or just review your books</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (members && members.length > 0) ? (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/30 border border-border/20" data-testid={`workspace-member-${m.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate" data-testid={`text-member-name-${m.id}`}>{m.username}</p>
                </div>
                <Select value={m.role} onValueChange={(v) => updateRoleMutation.mutate({ id: m.id, role: v })}>
                  <SelectTrigger className="h-8 w-32 bg-card/30 border-border/30 font-mono text-[10px]" data-testid={`select-member-role-${m.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0 border-border/30 text-muted-foreground hover:text-red-400" onClick={() => deleteMutation.mutate(m.id)} data-testid={`button-remove-member-${m.id}`} aria-label="Remove teammate">
                  <AlertCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] font-mono text-muted-foreground/40">No teammates yet. The primary admin always has owner access. Add collaborators below.</p>
        )}

        <div className="space-y-3 pt-3 border-t border-border/10">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Add Teammate</p>
          <div className="space-y-2">
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="input-member-username" />
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Temporary password (min 6 chars)" className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="input-member-password" />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="select-new-member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" className="neon-glow text-white border-0 font-mono text-[11px]" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !username.trim() || password.length < 6} data-testid="button-add-member">
            {addMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
            ADD TEAMMATE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function SecurityManager() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const matches = newPassword.length >= 12 && newPassword === confirmPassword;

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/change-password", {
      currentPassword,
      newPassword,
    }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your Lexora admin password has been changed." });
    },
    onError: (err: any) => {
      toast({
        title: "Password change failed",
        description: err?.message || "Check your current password and try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-border/20 bg-card/30">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
          <LockKeyhole className="h-3.5 w-3.5 text-emerald-400/70" /> Account Security
        </CardTitle>
        <CardDescription className="text-[10px] font-mono text-muted-foreground/40">
          Change the password used to access the Lexora admin workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider" htmlFor="current-password">Current Password</label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-10 bg-card/30 border-border/30 font-mono text-sm"
            data-testid="input-current-password"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider" htmlFor="new-password">New Password</label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 bg-card/30 border-border/30 font-mono text-sm"
              data-testid="input-new-password"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider" htmlFor="confirm-password">Confirm Password</label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 bg-card/30 border-border/30 font-mono text-sm"
              data-testid="input-confirm-password"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[10px] font-mono text-muted-foreground/40">
            Use at least 12 characters. Your current session stays signed in after the change.
          </p>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !currentPassword || !matches}
            className="neon-glow text-white border-0 font-mono text-[11px]"
            data-testid="button-change-password"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5 mr-1.5" />}
            {mutation.isPending ? "UPDATING..." : "CHANGE PASSWORD"}
          </Button>
        </div>
        {confirmPassword && newPassword !== confirmPassword ? (
          <p className="text-[10px] font-mono text-red-400/70">Passwords do not match.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}


interface CustomAiProviderConfig {
  enabled: boolean;
  name: string;
  baseUrl: string;
  fastModel: string;
  writingModel: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
}

function CustomAiProviderSettings() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<CustomAiProviderConfig>({
    queryKey: ["/api/settings/custom-ai-provider"],
  });
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("Custom API");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [fastModel, setFastModel] = useState("");
  const [writingModel, setWritingModel] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setName(data.name || "Custom API");
    setBaseUrl(data.baseUrl || "");
    setFastModel(data.fastModel || "");
    setWritingModel(data.writingModel || "");
    setApiKey("");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/settings/custom-ai-provider", {
        enabled,
        name,
        baseUrl,
        apiKey: apiKey.trim() || undefined,
        fastModel,
        writingModel,
      });
      return res.json() as Promise<CustomAiProviderConfig>;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["/api/settings/custom-ai-provider"], saved);
      setApiKey("");
      toast({ title: "Custom AI provider saved", description: saved.enabled ? "Lexora text generation will use this provider." : "Lexora will use its default provider." });
    },
    onError: (error: any) => toast({ title: "Provider save failed", description: error.message, variant: "destructive" }),
  });

  const test = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/custom-ai-provider/test", {});
      return res.json() as Promise<{ ok: boolean; model: string; text: string }>;
    },
    onSuccess: (result) => toast({ title: "Connection successful", description: `${result.model}: ${result.text || "responded"}` }),
    onError: (error: any) => toast({ title: "Connection failed", description: error.message, variant: "destructive" }),
  });

  const preset = (provider: "openrouter" | "gemini" | "groq") => {
    if (provider === "openrouter") {
      setName("OpenRouter");
      setBaseUrl("https://openrouter.ai/api/v1");
      setFastModel("openrouter/free");
      setWritingModel("nvidia/nemotron-3-ultra-550b-a55b:free");
    } else if (provider === "gemini") {
      setName("Google Gemini");
      setBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai");
      setFastModel("gemini-3.7-flash");
      setWritingModel("gemini-3.7-flash");
    } else {
      setName("Groq");
      setBaseUrl("https://api.groq.com/openai/v1");
      setFastModel("openai/gpt-oss-20b");
      setWritingModel("qwen/qwen3.8-27b");
    }
  };

  if (isLoading) return <Skeleton className="h-72 rounded-xl bg-muted/20" />;

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] via-card/30 to-purple-500/[0.04]" data-testid="custom-ai-provider-settings">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
              <PlugZap className="h-3.5 w-3.5 text-cyan-400/70" /> Custom AI Provider
            </CardTitle>
            <CardDescription className="text-[10px] font-mono text-muted-foreground/40 mt-1">
              Bring your own OpenAI-compatible API endpoint, key, and model IDs. Text generation only; image and voice providers stay separate.
            </CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="switch-custom-ai-provider" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="h-7 text-[9px] font-mono" onClick={() => preset("openrouter")}>OpenRouter</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-[9px] font-mono" onClick={() => preset("gemini")}>Gemini</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-[9px] font-mono" onClick={() => preset("groq")}>Groq</Button>
          <span className="self-center text-[9px] font-mono text-muted-foreground/35">or enter any compatible endpoint</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Provider name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-9 text-[11px] font-mono" placeholder="My Provider" />
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Base URL</label>
            <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="mt-1 h-9 text-[11px] font-mono" placeholder="https://provider.example/v1" data-testid="input-custom-ai-base-url" />
          </div>
        </div>

        <div>
          <label className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">API key</label>
          <div className="relative mt-1">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/35" />
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="h-9 pl-9 text-[11px] font-mono"
              placeholder={data?.hasApiKey ? `Saved: ${data.maskedApiKey || "••••••••"} — leave blank to keep it` : "Paste API key"}
              autoComplete="new-password"
              data-testid="input-custom-ai-api-key"
            />
          </div>
          <p className="text-[9px] font-mono text-muted-foreground/35 mt-1">The key is encrypted before storage and is never returned to the browser.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Fast model</label>
            <Input value={fastModel} onChange={(event) => setFastModel(event.target.value)} className="mt-1 h-9 text-[11px] font-mono" placeholder="model/id-for-fast-tasks" data-testid="input-custom-ai-fast-model" />
            <p className="text-[8px] font-mono text-muted-foreground/30 mt-1">Classification, summaries, market, metadata.</p>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Writing model</label>
            <Input value={writingModel} onChange={(event) => setWritingModel(event.target.value)} className="mt-1 h-9 text-[11px] font-mono" placeholder="model/id-for-long-form-writing" data-testid="input-custom-ai-writing-model" />
            <p className="text-[8px] font-mono text-muted-foreground/30 mt-1">Outlines, chapters, revisions, Scribe.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="h-8 text-[10px] font-mono" data-testid="button-save-custom-ai-provider">
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save Provider
          </Button>
          <Button type="button" variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !data?.hasApiKey} className="h-8 text-[10px] font-mono" data-testid="button-test-custom-ai-provider">
            {test.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            Test Saved Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { data: settings, isLoading, error } = useQuery<AppSettings | null>({ queryKey: ["/api/settings"] });
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTokenRef = useRef(0);

  const stopPreview = () => {
    previewTokenRef.current++;
    browserTTSStop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewState("idle");
  };

  useEffect(() => () => stopPreview(), []);

  const playPreview = async (voiceId: string) => {
    if (previewState !== "idle") {
      stopPreview();
      return;
    }
    if (isBrowserVoice(voiceId)) {
      setPreviewState("playing");
      browserTTSSpeak(PREVIEW_SAMPLE, voiceId, 1, {
        onEnd: () => setPreviewState("idle"),
        onError: () => { setPreviewState("idle"); toast({ title: "Preview failed", variant: "destructive" }); },
      });
      return;
    }
    const token = ++previewTokenRef.current;
    setPreviewState("loading");
    try {
      const endpoint = isFishAudioVoice(voiceId) ? "/api/fish-tts" : "/api/tts";
      const res = await apiRequest("POST", endpoint, { text: PREVIEW_SAMPLE, voice: voiceId });
      const data = await res.json();
      if (token !== previewTokenRef.current) return;
      if (!data.audio) throw new Error("No audio returned");
      const audio = new Audio(`data:audio/${data.format || "mp3"};base64,${data.audio}`);
      audioRef.current = audio;
      audio.onended = () => setPreviewState("idle");
      audio.onerror = () => { setPreviewState("idle"); toast({ title: "Preview failed", variant: "destructive" }); };
      await audio.play();
      setPreviewState("playing");
    } catch (err: any) {
      if (token !== previewTokenRef.current) return;
      setPreviewState("idle");
      toast({ title: "Preview unavailable", description: err?.message || "Could not generate voice sample", variant: "destructive" });
    }
  };

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultAuthorName: "Sergio A. Delgado",
      defaultVertical: "money",
      defaultLanguage: "english",
      aiModel: "high",
      chapterWordTarget: 3000,
      autoGenerateCover: true,
      autoGenerateMarketing: true,
      ttsDefaultVoice: DEFAULT_VOICE_ID,
      storefrontTitle: "Lexora Book Collection",
      exportFormat: "html",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        defaultAuthorName: settings.defaultAuthorName,
        defaultVertical: settings.defaultVertical,
        defaultLanguage: settings.defaultLanguage,
        aiModel: settings.aiModel,
        chapterWordTarget: settings.chapterWordTarget,
        autoGenerateCover: settings.autoGenerateCover,
        autoGenerateMarketing: settings.autoGenerateMarketing,
        ttsDefaultVoice: VOICE_OPTIONS.find(v => v.value === settings.ttsDefaultVoice)?.isUnavailable
          ? DEFAULT_VOICE_ID
          : settings.ttsDefaultVoice,
        storefrontTitle: settings.storefrontTitle,
        exportFormat: settings.exportFormat,
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const wordTarget = form.watch("chapterWordTarget");

  if (isLoading) {
    return (
      <div className="p-8 space-y-5">
        <Skeleton className="h-10 w-56 bg-muted/20" />
        <Skeleton className="h-80 rounded-xl bg-muted/20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load settings</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-7 overflow-y-auto h-full max-w-3xl">
      <Helmet>
        <title>Settings — Lexora</title>
        <meta name="description" content="Configure your Lexora publishing platform — defaults, AI models, storefront, and export preferences." />
      </Helmet>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-purple-500/50" />
          <span className="text-[9px] font-mono font-bold text-purple-400/60 tracking-[0.2em] uppercase">CONFIGURATION</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">App <span className="shimmer-text">Settings</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Configure defaults and preferences for your publishing pipeline</p>
      </div>

      <div className="line-glow" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-purple-400/70" /> Author Defaults
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Pre-filled when creating new projects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="defaultAuthorName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Author Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10 bg-card/30 border-border/30 font-mono text-sm" data-testid="input-default-author" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="defaultVertical" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Vertical</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-default-vertical" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="defaultLanguage" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Language</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-default-language" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LANGUAGES.map(l => <SelectItem key={l} value={l}>{LANGUAGE_LABELS[l] || l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-cyan-400/70" /> AI Configuration
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Control AI model and generation behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="aiModel" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">AI Model Preference</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-ai-model" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {aiModelOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          <span>{o.label}</span>
                          <span className="text-muted-foreground/40 text-[10px] ml-2">— {o.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="chapterWordTarget" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Chapter Word Target</FormLabel>
                    <Badge variant="outline" className="font-mono text-[10px] border-border/30">{wordTarget.toLocaleString()} words</Badge>
                  </div>
                  <FormControl>
                    <Slider min={500} max={10000} step={250} value={[field.value]} onValueChange={([v]) => field.onChange(v)} data-testid="slider-word-target" />
                  </FormControl>
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground/30"><span>500</span><span>10,000</span></div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <CustomAiProviderSettings />

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400/70" /> Pipeline Automation
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Auto-trigger steps after chapter generation completes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="autoGenerateCover" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-auto-cover" />
                    </FormControl>
                    <div>
                      <FormLabel className="text-[12px] font-bold font-mono flex items-center gap-2">
                        <Image className="h-3 w-3 text-pink-400/60" /> Auto-Generate Cover
                      </FormLabel>
                      <p className="text-[10px] text-muted-foreground/40 font-mono">Automatically create AI cover art when all chapters are written</p>
                    </div>
                  </div>
                </FormItem>
              )} />

              <div className="border-t border-border/10" />

              <FormField control={form.control} name="autoGenerateMarketing" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-auto-marketing" />
                    </FormControl>
                    <div>
                      <FormLabel className="text-[12px] font-bold font-mono flex items-center gap-2">
                        <Megaphone className="h-3 w-3 text-pink-400/60" /> Auto-Generate Marketing
                      </FormLabel>
                      <p className="text-[10px] text-muted-foreground/40 font-mono">Automatically create marketing assets when book is complete</p>
                    </div>
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400/70" /> Narration
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Default voice for AI narrator across all books</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="ttsDefaultVoice" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Narrator Voice</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <div className="flex-1"><VoiceSelector value={field.value} onChange={field.onChange} /></div>
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => playPreview(field.value)}
                      className="h-10 shrink-0 border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10 font-mono text-[11px]"
                      data-testid="button-preview-voice"
                    >
                      {previewState === "loading" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : previewState === "playing" ? <Square className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                      {previewState === "loading" ? "LOADING" : previewState === "playing" ? "STOP" : "PREVIEW"}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Store className="h-3.5 w-3.5 text-purple-400/70" /> Storefront
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Customize your public reader storefront</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="storefrontTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Storefront Title</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10 bg-card/30 border-border/30 font-mono text-sm" data-testid="input-storefront-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Download className="h-3.5 w-3.5 text-cyan-400/70" /> Export
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Default format when exporting books</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="exportFormat" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Export Format</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-export-format" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {exportFormatOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-settings" className="neon-glow text-white border-0 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] font-mono text-[12px]">
              <Save className="h-4 w-4 mr-2" />
              {mutation.isPending ? "SAVING..." : "SAVE SETTINGS"}
            </Button>
          </div>
        </form>
      </Form>

      <SecurityManager />
      <WorkspaceMemberManager />
      <BrandKitManager />
      <MembershipTierManager />
    </div>
  );
}
