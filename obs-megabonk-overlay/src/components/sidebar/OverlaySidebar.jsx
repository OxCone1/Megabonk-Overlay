import { useEffect, useCallback, useRef, useTransition, useState, Suspense } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useOverlayStore, ELEMENT_TYPES, RESOLUTION_PRESETS } from '@/stores/overlayStore';
import { useGameDataStore } from '@/stores/gameDataStore';
import { useSmartInteractionsStore, INTERACTION_TYPES, STAT_CONFIG } from '@/stores/smartInteractionsStore';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { createLayoutPayload, encodeLayoutPayload, decodeLayoutPayload } from '@/lib/layoutShare';
import { toast } from 'sonner';
import { 
  User, Users, Settings, Grid3X3, Eye, EyeOff, 
  ChevronDown, GripVertical, Package, Sword, BookOpen,
  Heart, Skull, Timer, BarChart3, Plus, Trash2, Flag, Ban,
  Play, Pause, Square, Zap, FlaskConical,
  CloudUpload, CloudDownload, CloudOff, Github
} from 'lucide-react';

// Draggable element item for the sidebar
function DraggableElementItem({ type, label, description, icon, playerId }) {
  const { addElement, getResolutionDimensions, canvasZoom } = useOverlayStore();
  const { t } = useI18n();
  
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `palette-${type}-${playerId}`,
    data: { type, playerId },
  });
  
  const handleClick = () => {
    const dimensions = getResolutionDimensions();
    const config = ELEMENT_TYPES.find(e => e.type === type);
    const elementWidth = config?.defaultSize.width || 150;
    const elementHeight = config?.defaultSize.height || 80;
    const canvasElement = document.querySelector('[data-canvas="true"]');

    let targetX = (dimensions.width - elementWidth) / 2;
    let targetY = (dimensions.height - elementHeight) / 2;

    if (canvasElement) {
      const rect = canvasElement.getBoundingClientRect();
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const canvasX = (screenCenterX - rect.left) / (canvasZoom || 1);
      const canvasY = (screenCenterY - rect.top) / (canvasZoom || 1);
      targetX = canvasX - (elementWidth / 2);
      targetY = canvasY - (elementHeight / 2);
    }

    const clampedX = Math.max(0, Math.min(targetX, dimensions.width - elementWidth));
    const clampedY = Math.max(0, Math.min(targetY, dimensions.height - elementHeight));

    addElement(type, playerId, { x: clampedX, y: clampedY });
  };
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
  } : undefined;
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md cursor-grab active:cursor-grabbing",
        "bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors",
        "border border-transparent hover:border-sidebar-border"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="p-1.5 rounded bg-sidebar-primary/10 text-sidebar-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-sidebar-foreground truncate">{label}</div>
        <div className="text-xs text-sidebar-foreground/60 truncate">{description}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        className="p-1 rounded hover:bg-sidebar-primary/20 text-sidebar-foreground/60 hover:text-sidebar-foreground"
        title={t('addToCanvas', 'Add to canvas')}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

// Category icon mapping
const categoryIcons = {
  equipment: <Sword size={14} />,
  items: <Package size={14} />,
  stats: <BarChart3 size={14} />,
  'stats-individual': <BarChart3 size={14} />,
  combat: <Skull size={14} />,
  'combat-individual': <Skull size={14} />,
  'game-info': <Timer size={14} />,
  'match-player': <Flag size={14} />,
  match: <Flag size={14} />,
  session: <BarChart3 size={14} />,
  bans: <Ban size={14} />,
  season: <Flag size={14} />,
  shapes: <Square size={14} />,
};

// Category display names
const categoryNames = {
  equipment: 'Equipment',
  items: 'Items',
  stats: 'Stats (Groups)',
  'stats-individual': 'Stats (Individual)',
  combat: 'Combat (Groups)',
  'combat-individual': 'Combat (Individual)',
  'game-info': 'Game Info',
  'match-player': 'Matchmaking',
  match: 'Matchmaking',
  session: 'Session Statistics',
  bans: 'Room Bans',
  season: 'Season Info',
  shapes: 'Shapes',
};

// Element palette organized by category
function ElementPalette({ playerId }) {
  const { t, getElementLabel, getElementDescription } = useI18n();
  const advancedSettingsEnabled = useOverlayStore(s => s.advancedSettingsEnabled);
  const smartInteractionsEnabled = useOverlayStore(s => s.smartInteractionsEnabled);
  const categories = ['equipment', 'items', 'stats', 'stats-individual', 'combat', 'combat-individual', 'game-info', 'match-player', 'shapes'];
  const sharedCategories = ['match', 'session', 'season', 'bans'];
  
  return (
    <div className="flex flex-col gap-2 overflow-x-hidden w-full">
      {categories.map(category => {
        // Filter out smart-interactions if experimental features are disabled
        const elements = ELEMENT_TYPES.filter(e => {
          if (e.category !== category) return false;
          if (e.type === 'smart-interactions' && !(advancedSettingsEnabled && smartInteractionsEnabled)) return false;
          return true;
        });
        const categoryLabel = t(`category.${category}`, categoryNames[category] || category.replace('-', ' '));
        
        // Default to collapsed for individual stats (there are many)
        const defaultOpen = !category.includes('individual');
        
        // Skip categories with no elements
        if (elements.length === 0) return null;
        
        return (
          <Collapsible key={category} defaultOpen={defaultOpen} className="w-full">
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors min-w-0">
              <div className="text-sidebar-foreground/60 shrink-0">{categoryIcons[category]}</div>
              <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/80 flex-1 text-left truncate min-w-0">
                {categoryLabel}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{elements.length}</Badge>
              <ChevronDown size={14} className="text-sidebar-foreground/40 shrink-0" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col w-full gap-1 mt-1 overflow-x-hidden">
                {elements.map(element => (
                  <DraggableElementItem
                    key={element.type}
                    type={element.type}
                    label={getElementLabel(element.type, element.label)}
                    description={getElementDescription(element.type, element.description)}
                    icon={categoryIcons[category]}
                    playerId={playerId}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <Separator className="my-2" />
      <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
        {t('sharedElements', 'Shared Elements')}
      </div>
      {sharedCategories.map(category => {
        const elements = ELEMENT_TYPES.filter(e => e.category === category);
        const categoryLabel = t(`category.${category}`, categoryNames[category] || category.replace('-', ' '));

        // Skip categories with no elements
        if (elements.length === 0) return null;

        return (
          <Collapsible key={`shared-${category}`} defaultOpen className="w-full">
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors min-w-0">
              <div className="text-sidebar-foreground/60 shrink-0">{categoryIcons[category]}</div>
              <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/80 flex-1 text-left truncate min-w-0">
                {categoryLabel}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{elements.length}</Badge>
              <ChevronDown size={14} className="text-sidebar-foreground/40 shrink-0" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col w-full gap-1 mt-1 overflow-x-hidden">
                {elements.map(element => (
                  <DraggableElementItem
                    key={element.type}
                    type={element.type}
                    label={getElementLabel(element.type, element.label)}
                    description={getElementDescription(element.type, element.description)}
                    icon={categoryIcons[category]}
                    playerId={playerId}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function PlayerRunEndSettings({ playerId }) {
  const { t } = useI18n();
  const perPlayerEndBlurEnabled = useOverlayStore(s => s.perPlayerEndBlurEnabled);
  const setPlayerEndBlurEnabled = useOverlayStore(s => s.setPlayerEndBlurEnabled);
  const enabled = perPlayerEndBlurEnabled?.[playerId] ?? true;

  return (
    <div className="mb-3 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3 mt-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
        {t('runEndEffects', 'Run End Effects')}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <div className="text-xs font-medium text-sidebar-foreground/80">
            {t('blurOnRunEnd', 'Blur on run end')}
          </div>
          <div className="text-[10px] text-sidebar-foreground/50">
            {t('blurOnRunEndHint', 'Blur and label this player when their run ends')}
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => setPlayerEndBlurEnabled(playerId, checked)}
        />
      </div>
    </div>
  );
}

// Smart Interactions Settings Panel
function SmartInteractionsSettings() {
  const {
    enabledInteractions,
    toggleInteraction,
    updateDisplaySettings,
    clearAllEvents,
  } = useSmartInteractionsStore();
  const displaySettings = useSmartInteractionsStore(s => s.displaySettings) || {};
  
  const interactionTypes = Object.values(INTERACTION_TYPES);
  
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />
          <span className="text-xs font-medium text-sidebar-foreground/80">
            Smart Interactions
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-[10px] h-6 px-2"
          onClick={clearAllEvents}
        >
          Clear Events
        </Button>
      </div>
      
      <p className="text-[10px] text-sidebar-foreground/40">
        Show animated notifications when stats or items change from interactions.
      </p>
      
      <Collapsible defaultOpen className="w-full">
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/80 flex-1 text-left">
            Interaction Types
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {Object.values(enabledInteractions).filter(Boolean).length}/{interactionTypes.length}
          </Badge>
          <ChevronDown size={14} className="text-sidebar-foreground/40 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-1 mt-1">
            {interactionTypes.map((type) => (
              <div
                key={type.id}
                className="flex items-center justify-between p-2 rounded hover:bg-sidebar-accent/30"
              >
                <div className="flex items-center gap-2">
                  {type.icon ? (
                    <img 
                      src={type.icon} 
                      alt=""
                      className="w-4 h-4 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                  <span className={cn("text-xs", type.color)}>{type.label}</span>
                </div>
                <Switch
                  checked={enabledInteractions[type.id]}
                  onCheckedChange={() => toggleInteraction(type.id)}
                />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      <Collapsible className="w-full">
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/80 flex-1 text-left">
            Display Settings
          </span>
          <ChevronDown size={14} className="text-sidebar-foreground/40 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-3 mt-2 p-2">
            <div>
              <label className="text-xs text-sidebar-foreground/60 mb-1 block">
                Display Duration: {(displaySettings.duration / 1000).toFixed(1)}s
              </label>
              <Input
                type="range"
                min="2000"
                max="15000"
                step="500"
                value={displaySettings.duration}
                onChange={(e) => updateDisplaySettings({ duration: parseInt(e.target.value) })}
              />
            </div>
            
            <div>
              <label className="text-xs text-sidebar-foreground/60 mb-1 block">
                Max Visible Events: {displaySettings.maxVisible}
              </label>
              <Input
                type="range"
                min="1"
                max="6"
                step="1"
                value={displaySettings.maxVisible}
                onChange={(e) => updateDisplaySettings({ maxVisible: parseInt(e.target.value) })}
              />
            </div>
            
            <div>
              <label className="text-xs text-sidebar-foreground/60 mb-1 block">
                Animation Style
              </label>
              <Select 
                value={displaySettings.animationStyle} 
                onValueChange={(value) => updateDisplaySettings({ animationStyle: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="fade">Fade</SelectItem>
                  <SelectItem value="pop">Pop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-sidebar-foreground/60 mb-1 block">
                Smart UI Scale: {(displaySettings.uiScale || 1).toFixed(2)}x
              </label>
              <Input
                type="range"
                min="0.8"
                max="2.0"
                step="0.05"
                value={displaySettings.uiScale || 1}
                onChange={(e) => updateDisplaySettings({ uiScale: parseFloat(e.target.value) })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-xs text-sidebar-foreground/60">
                Show Stat Changes
              </label>
              <Switch
                checked={displaySettings.showStatChanges}
                onCheckedChange={(checked) => updateDisplaySettings({ showStatChanges: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-xs text-sidebar-foreground/60">
                Show Item Changes
              </label>
              <Switch
                checked={displaySettings.showItemChanges}
                onCheckedChange={(checked) => updateDisplaySettings({ showItemChanges: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs text-sidebar-foreground/60">
                Debug Logging
              </label>
              <Switch
                checked={displaySettings.debugLogging}
                onCheckedChange={(checked) => updateDisplaySettings({ debugLogging: checked })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Settings panel
function SettingsPanel() {
  const { 
    resolution, 
    setResolution, 
    customResolution, 
    setCustomResolution,
    gridSize,
    setGridSize,
    showGrid,
    setShowGrid,
    gridEnabled,
    setGridEnabled,
    transparentBackground,
    setTransparentBackground,
    obsHideLabels,
    setObsHideLabels,
    backgroundImageUrl,
    setBackgroundImageUrl,
    iconScale,
    setIconScale,
    iconSource,
    setIconSource,
    resetCanvasView,
    elements,
    removeElement,
    autoSpectatorMode,
    setAutoSpectatorMode,
    isSpectator,
    activeRoom,
    timeFlowDirection,
    setTimeFlowDirection,
    sidebarAutoHide,
    setSidebarAutoHide,
    allowUserSelect,
    setAllowUserSelect,
    setSidebarOpen,
    setSidebarVisible,
    advancedSettingsEnabled,
    setAdvancedSettingsEnabled,
    smartInteractionsEnabled,
    setSmartInteractionsEnabled,
    showElementOutlines,
    setShowElementOutlines,
    hideElementTitles,
    setHideElementTitles,
    spoofEnabled,
    setSpoofEnabled,
    spoofMatchState,
    setSpoofMatchState,
    spoofItemCounts,
    setSpoofItemCounts,
    spoofDiffs,
    setSpoofDiffs,
    spoofSessionGamesCount,
    setSpoofSessionGamesCount,
    spoofStageHistory,
    setSpoofStageHistory,
    showClippingWarnings,
    setShowClippingWarnings,
    globalBlurOnMatchEnd,
    setGlobalBlurOnMatchEnd,
    setSessionStats,
    sessionGameDisplayLimit,
    setSessionGameDisplayLimit,
    statPlainFormat,
    setStatPlainFormat,
    historyLimit,
    setHistoryLimit,
    setPlayer1State,
    setPlayer2State,
    setActiveRoom,
    setIsSpectator,
    setRoomBans,
    setRoomMeta,
    setQueueState,
    setMatchEndState,
    clearMatchEndState,
    currentUserId,
    seasonInfo,
    groups,
    deleteGroup,
    savedLayouts,
    saveLayout,
    deleteSavedLayout,
  } = useOverlayStore();

  const {
    showUnreliableStats,
    setShowUnreliableStats,
    toggleStatVisibility,
    availableStatKeys,
    statVisibility,
  } = useSmartInteractionsStore();

  // Debug helpers for firing fake events (only available when debug logging enabled)
  const displaySettings = useSmartInteractionsStore(s => s.displaySettings) || {};
  const fireDebugEvent = useSmartInteractionsStore(s => s.fireDebugEvent);

  const { t, getElementLabel, language, setLanguage } = useI18n();
  const [layoutString, setLayoutString] = useState('');
  const [layoutError, setLayoutError] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('chest');
  const [selectedLayoutId, setSelectedLayoutId] = useState('');
  const [isSaveLayoutDialogOpen, setIsSaveLayoutDialogOpen] = useState(false);
  const [saveLayoutName, setSaveLayoutName] = useState('');
  const [saveLayoutError, setSaveLayoutError] = useState('');
  const spoofMatchEndTimersRef = useRef({ fade: null, clear: null });

  const { heroes, weapons, tomes, items, localImageMap } = useGameDataStore();

  const itemPool = (items && items.length > 0) ? items : (localImageMap?.items || []);
  const itemPoolByRarity = {
    0: itemPool.filter((item) => item.rarity === 0),
    1: itemPool.filter((item) => item.rarity === 1),
    2: itemPool.filter((item) => item.rarity === 2),
    3: itemPool.filter((item) => item.rarity === 3),
  };
  
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImageUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const buildFakeStats = () => ({
    MaxHealth: 120 + Math.round(Math.random() * 80),
    HealthRegen: Math.random() * 4,
    Shield: Math.round(Math.random() * 60),
    Overheal: Math.round(Math.random() * 30),
    HealingMultiplier: 1 + Math.random(),
    Lifesteal: Math.random() * 0.2,
    DamageMultiplier: 1 + Math.random() * 2,
    AttackSpeed: 1 + Math.random() * 1.5,
    CritChance: Math.random() * 0.4,
    CritDamage: 1 + Math.random() * 2,
    Projectiles: 1 + Math.floor(Math.random() * 4),
    ProjectileBounces: Math.floor(Math.random() * 3),
    SizeMultiplier: 1 + Math.random() * 0.5,
    Armor: Math.random() * 0.5,
    Evasion: Math.random() * 0.5,
    Thorns: Math.round(Math.random() * 12),
    DamageReductionMultiplier: Math.random() * 0.5,
    FireDamage: 1 + Math.random(),
    IceDamage: 1 + Math.random(),
    LightningDamage: 1 + Math.random(),
    BurnChance: Math.random() * 0.3,
    FreezeChance: Math.random() * 0.3,
    MoveSpeedMultiplier: 1 + Math.random(),
    JumpHeight: 1 + Math.random() * 2,
    ExtraJumps: Math.floor(Math.random() * 3),
    PickupRange: 1 + Math.random() * 2,
    DurationMultiplier: 1 + Math.random(),
    ProjectileSpeedMultiplier: 1 + Math.random(),
    KnockbackMultiplier: 1 + Math.random(),
    Luck: Math.random() * 0.5,
    GoldIncreaseMultiplier: 1 + Math.random(),
    XpIncreaseMultiplier: 1 + Math.random(),
    SilverIncreaseMultiplier: 1 + Math.random(),
    ChestIncreaseMultiplier: 1 + Math.random(),
    ShopPriceReduction: Math.random() * 0.5,
    PowerupBoostMultiplier: 1 + Math.random(),
    PowerupChance: Math.random() * 0.4,
    Difficulty: 1 + Math.random() * 2,
    EliteSpawnIncrease: 1 + Math.random(),
    EnemyAmountMultiplier: 1 + Math.random(),
    EnemySizeMultiplier: 1 + Math.random(),
    EnemySpeedMultiplier: 1 + Math.random(),
    EnemyHpMultiplier: 1 + Math.random(),
    EnemyDamageMultiplier: 1 + Math.random(),
    EnemyScalingMultiplier: 1 + Math.random(),
    EliteDamageMultiplier: 1 + Math.random(),
  });

  const pickRandom = (list) => {
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  };

  const pickMany = (pool, count) => {
    if (!pool || pool.length === 0) return [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const buildFakeEquipment = () => {
    const weaponPool = (weapons && weapons.length > 0) ? weapons : (localImageMap?.weapons || []);
    const tomePool = (tomes && tomes.length > 0) ? tomes : (localImageMap?.tomes || []);

    const clampCount = (count, max) => Math.max(0, Math.min(count || 0, max || 0));

    const weaponCount = Math.min(4, weaponPool.length || 0);
    const tomeCount = Math.min(4, tomePool.length || 0);

    const selectedItems = [0, 1, 2, 3].flatMap((rarity) => {
      const pool = itemPoolByRarity[rarity] || [];
      const desired = clampCount(spoofItemCounts?.[rarity], pool.length);
      return pickMany(pool, desired).map((item) => ({
        id: item.ingameId,
        count: 1 + Math.floor(Math.random() * 4),
        rarity: item.rarity,
      }));
    });

    return {
      weapons: pickMany(weaponPool, weaponCount).map(w => ({ id: w.ingameId, level: 1 + Math.floor(Math.random() * 20) })),
      tomes: pickMany(tomePool, tomeCount).map(t => ({ id: t.ingameId, level: 1 + Math.floor(Math.random() * 20) })),
      items: selectedItems,
    };
  };

  const buildFakeRoomBans = () => {
    const heroPool = (heroes && heroes.length > 0) ? heroes : (localImageMap?.heroes || []);
    const weaponPool = (weapons && weapons.length > 0) ? weapons : (localImageMap?.weapons || []);
    const tomePool = (tomes && tomes.length > 0) ? tomes : (localImageMap?.tomes || []);

    const createScope = () => ({
      heroes: pickMany(heroPool, Math.min(2, heroPool.length)).map(h => h.ingameId),
      weapons: pickMany(weaponPool, Math.min(1, weaponPool.length)).map(w => w.ingameId),
      tomes: pickMany(tomePool, Math.min(1, tomePool.length)).map(t => t.ingameId),
      items: {
        common: pickMany(itemPoolByRarity[0] || [], Math.min(1, itemPoolByRarity[0]?.length || 0)).map(i => i.ingameId),
        rare: pickMany(itemPoolByRarity[1] || [], Math.min(1, itemPoolByRarity[1]?.length || 0)).map(i => i.ingameId),
        epic: pickMany(itemPoolByRarity[2] || [], Math.min(1, itemPoolByRarity[2]?.length || 0)).map(i => i.ingameId),
        legendary: pickMany(itemPoolByRarity[3] || [], Math.min(1, itemPoolByRarity[3]?.length || 0)).map(i => i.ingameId),
      },
    });

    return {
      system: createScope(),
      player1: createScope(),
      player2: createScope(),
    };
  };

  const buildFakeCombat = () => ({
    killCount: Math.floor(Math.random() * 500),
    currentGold: Math.floor(Math.random() * 5000),
    totalDamageDealt: Math.floor(Math.random() * 50000),
    totalDamageTaken: Math.floor(Math.random() * 20000),
    shrines: {
      balance: Math.floor(Math.random() * 5),
      greed: Math.floor(Math.random() * 5),
      challenge: Math.floor(Math.random() * 5),
      cursed: Math.floor(Math.random() * 5),
      magnet: Math.floor(Math.random() * 5),
      moai: Math.floor(Math.random() * 5),
      charge_normal: Math.floor(Math.random() * 5),
      charge_golden: Math.floor(Math.random() * 5),
    },
    gameStats: {
      gold_earned: Math.floor(Math.random() * 100000),
      gold_spent: Math.floor(Math.random() * 80000),
      xp_gained: Math.floor(Math.random() * 60000),
      elite_kills: Math.floor(Math.random() * 50),
      boss_kills: Math.floor(Math.random() * 10),
      miniboss_kills: Math.floor(Math.random() * 20),
      skeleton_kills: Math.floor(Math.random() * 300),
      goblin_kills: Math.floor(Math.random() * 200),
      fire_kills: Math.floor(Math.random() * 200),
      lightning_kills: Math.floor(Math.random() * 200),
      crits: Math.floor(Math.random() * 400),
      evades: Math.floor(Math.random() * 200),
      projectiles_fired: Math.floor(Math.random() * 5000),
      items_picked_up: Math.floor(Math.random() * 200),
      chests_opened: Math.floor(Math.random() * 120),
      chests_bought: Math.floor(Math.random() * 80),
      pots_broken: Math.floor(Math.random() * 200),
      powerups_used: Math.floor(Math.random() * 60),
    },
    damageSources: {
      weapon: Math.floor(Math.random() * 30000),
      fire: Math.floor(Math.random() * 20000),
      lightning: Math.floor(Math.random() * 15000),
      ice: Math.floor(Math.random() * 12000),
    }
  });

  const randomInt = (min, max) => (
    Math.floor(Math.random() * (max - min + 1)) + min
  );

  const buildFakeSessionGames = (count, startRating) => {
    const total = Math.max(0, Math.min(40, count || 0));
    let rating = Number.isFinite(startRating) ? startRating : randomInt(900, 1400);
    const now = Date.now();
    return Array.from({ length: total }).map((_, index) => {
      const delta = randomInt(-45, 45);
      rating += delta;
      return {
        timestamp: now - ((total - index) * 8 * 60 * 1000),
        delta,
        result: delta >= 0 ? 'Win' : 'Loss',
        ratingAfter: rating,
      };
    });
  };

  const updateSpoofStageEntry = (playerId, stageNumber, field, rawValue) => {
    const nextValue = rawValue === '' ? null : Number(rawValue);
    const resolved = Number.isFinite(nextValue) ? Math.max(0, Math.floor(nextValue)) : null;
    setSpoofStageHistory({
      ...(spoofStageHistory || {}),
      [playerId]: {
        ...(spoofStageHistory?.[playerId] || {}),
        [stageNumber]: {
          ...(spoofStageHistory?.[playerId]?.[stageNumber] || {}),
          [field]: resolved,
        },
      },
    });
  };

  const generateFakePlayerState = (playerId) => {
    const heroPool = (heroes && heroes.length > 0) ? heroes : (localImageMap?.heroes || []);
    const hero = pickRandom(heroPool);
    const stats = buildFakeStats();
    const equipment = buildFakeEquipment();

    return {
      playerId,
      status: 'in_progress',
      timeElapsed: Math.floor(Math.random() * 3600),
      isPaused: Math.random() > 0.85,
      pauseTime: Math.floor(Math.random() * 200),
      startedAt: Date.now(),
      lastUpdated: Date.now(),
      character: {
        id: hero?.ingameId || 1,
        name: hero?.name || `Hero ${playerId}`,
        level: 1 + Math.floor(Math.random() * 25),
        stats,
      },
      equipment,
      combat: buildFakeCombat(),
    };
  };

  const applySpoofMatchState = (nextState) => {
    const spoofUserId = currentUserId || 1;
    const opponentId = spoofUserId + 1;
    const currentState = useOverlayStore.getState();
    const MATCH_END_FADE_DELAY_MS = 2500;
    const MATCH_END_FADE_MS = 500;
    const MATCH_END_HOLD_MS = MATCH_END_FADE_DELAY_MS + MATCH_END_FADE_MS;
    const baseRoomMeta = {
      roomId: 'spoof-room',
      lobbyNumber: 123456,
      queueType: 'ranked',
      status: null,
      phase: null,
      map: null,
      winnerId: null,
      player1_id: spoofUserId,
      player2_id: opponentId,
      player1Profile: { nickname: 'You' },
      player2Profile: { nickname: 'Opponent' },
      gamePhaseStartedAt: null,
      player1GameStatus: null,
      player2GameStatus: null,
      currentPlayerGameStatus: null,
      player1ReadyBanSelection: false,
      player2ReadyBanSelection: false,
      currentPlayerReadyBanSelection: false,
    };

    const baseQueueState = {
      inQueue: false,
      queueType: 'ranked',
      seasonId: 1,
      rating: 1000,
      queueSize: 2,
      elapsedTime: 42,
      status: 'idle',
      proposalId: 'spoof-proposal',
      matchTimeout: 20,
      playerAccepted: false,
      opponentAccepted: false,
      declinedBy: null,
      message: null,
      lastEvent: 'spoof',
    };

    const emptyRoomMeta = {
      roomId: null,
      lobbyNumber: null,
      queueType: null,
      status: null,
      phase: null,
      map: null,
      winnerId: null,
      player1_id: null,
      player2_id: null,
      player1Profile: null,
      player2Profile: null,
      gamePhaseStartedAt: null,
      player1GameStatus: null,
      player2GameStatus: null,
      currentPlayerGameStatus: null,
      player1ReadyBanSelection: null,
      player2ReadyBanSelection: null,
      currentPlayerReadyBanSelection: null,
    };

    let nextRoomMeta = emptyRoomMeta;
    let nextQueueState = { ...baseQueueState };

    if (spoofMatchEndTimersRef.current.fade) {
      clearTimeout(spoofMatchEndTimersRef.current.fade);
      spoofMatchEndTimersRef.current.fade = null;
    }
    if (spoofMatchEndTimersRef.current.clear) {
      clearTimeout(spoofMatchEndTimersRef.current.clear);
      spoofMatchEndTimersRef.current.clear = null;
    }
    clearMatchEndState();

    switch (nextState) {
      case 'searching':
        nextQueueState = { ...baseQueueState, inQueue: true, status: 'searching' };
        break;
      case 'match_found':
        nextQueueState = { ...baseQueueState, status: 'match_found' };
        break;
      case 'accept_pending':
        nextQueueState = { ...baseQueueState, status: 'accept_pending' };
        break;
      case 'match_confirmed':
        nextQueueState = { ...baseQueueState, status: 'match_confirmed' };
        nextRoomMeta = { ...baseRoomMeta, status: 'active' };
        break;
      case 'ban_selection':
        nextQueueState = { ...baseQueueState, status: 'match_confirmed' };
        nextRoomMeta = { ...baseRoomMeta, status: 'active', phase: 'ban_selection' };
        break;
      case 'waiting_opponent':
        nextQueueState = { ...baseQueueState, status: 'match_confirmed' };
        nextRoomMeta = { ...baseRoomMeta, status: 'active' };
        setPlayer2State(null);
        break;
      case 'game':
        nextQueueState = { ...baseQueueState, status: 'match_confirmed' };
        nextRoomMeta = { ...baseRoomMeta, status: 'active', phase: 'game', gamePhaseStartedAt: Date.now() };
        break;
      case 'p1_death':
        nextQueueState = { ...baseQueueState, status: 'match_confirmed' };
        nextRoomMeta = { ...baseRoomMeta, status: 'active', phase: 'game', gamePhaseStartedAt: Date.now(), player1GameStatus: 'died' };
        if (currentState.player1State) {
          setPlayer1State({ ...currentState.player1State, status: 'ended' });
        }
        break;
      case 'p2_death':
        nextQueueState = { ...baseQueueState, status: 'match_confirmed' };
        nextRoomMeta = { ...baseRoomMeta, status: 'active', phase: 'game', gamePhaseStartedAt: Date.now(), player2GameStatus: 'died' };
        if (currentState.player2State) {
          setPlayer2State({ ...currentState.player2State, status: 'ended' });
        }
        break;
      case 'ended':
        nextRoomMeta = {
          ...baseRoomMeta,
          status: 'ended',
          phase: 'ended',
          winnerId: spoofUserId,
          player1GameStatus: 'victory',
          player2GameStatus: 'defeat',
          currentPlayerGameStatus: 'victory',
        };
        break;
      case 'cancelled':
        nextQueueState = { ...baseQueueState, status: 'match_cancelled', message: 'Player left', declinedBy: spoofUserId };
        nextRoomMeta = {
          ...baseRoomMeta,
          status: 'cancelled',
          phase: 'ended',
          winnerId: opponentId,
          player1GameStatus: 'defeat',
          player2GameStatus: 'victory',
          currentPlayerGameStatus: 'defeat',
        };
        break;
      case 'idle':
      default:
        break;
    }

    if (nextState !== 'waiting_opponent') {
      if (!currentState.player1State) setPlayer1State(generateFakePlayerState(spoofUserId));
      if (!currentState.player2State) setPlayer2State(generateFakePlayerState(opponentId));
    }
    
    // For death states, ensure we have player data with proper status
    if (nextState === 'p1_death' && !currentState.player1State) {
      const p1State = generateFakePlayerState(spoofUserId);
      p1State.status = 'ended';
      setPlayer1State(p1State);
    }
    if (nextState === 'p2_death' && !currentState.player2State) {
      const p2State = generateFakePlayerState(opponentId);
      p2State.status = 'ended';
      setPlayer2State(p2State);
    }

    setQueueState(nextQueueState);
    setRoomMeta(nextRoomMeta);
    if (nextState === 'ended' || nextState === 'cancelled') {
      const now = Date.now();
      setMatchEndState({
        active: true,
        status: nextRoomMeta.status || nextRoomMeta.phase || 'ended',
        roomId: nextRoomMeta.roomId,
        endedAt: now,
        fadeActive: false,
        fadeStartedAt: null,
        fadeDuration: MATCH_END_FADE_MS,
      });

      spoofMatchEndTimersRef.current.fade = setTimeout(() => {
        const state = useOverlayStore.getState();
        setMatchEndState({
          ...state.matchEndState,
          active: true,
          fadeActive: true,
          fadeStartedAt: Date.now(),
          fadeDuration: MATCH_END_FADE_MS,
        });
      }, MATCH_END_FADE_DELAY_MS);

      spoofMatchEndTimersRef.current.clear = setTimeout(() => {
        clearMatchEndState();
      }, MATCH_END_HOLD_MS);
    }
    if (nextState === 'ended' || nextState === 'cancelled') {
      setRoomBans({
        system: { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
        player1: { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
        player2: { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
      });
    }
  };

  const handleGenerateSpoofData = () => {
    const spoofUserId = currentUserId || 1;
    const opponentId = spoofUserId + 1;
    const player1 = generateFakePlayerState(spoofUserId);
    const player2 = generateFakePlayerState(opponentId);
    setPlayer1State(player1);
    setPlayer2State(player2);
    setActiveRoom('spoof-room');
    setIsSpectator(false);
    setRoomBans(buildFakeRoomBans());
    applySpoofMatchState(spoofMatchState || 'idle');
  };

  const handleGenerateSpoofSessionGames = () => {
    const startRating = randomInt(900, 1400);
    const startRank = randomInt(1, 5000);
    const games = buildFakeSessionGames(spoofSessionGamesCount, startRating);
    const currentRating = games.length > 0 ? games[games.length - 1].ratingAfter : startRating;
    const currentRank = Math.max(1, startRank + randomInt(-30, 30));
    setSessionStats({
      active: true,
      startRating,
      startRank,
      currentRating,
      currentRank,
      games,
      lastUpdated: Date.now(),
    });
  };

  const handleGenerateLayoutString = () => {
    const payload = createLayoutPayload(useOverlayStore.getState());
    const encoded = encodeLayoutPayload(payload);
    setLayoutString(encoded);
    setLayoutError('');
  };

  const handleApplyLayoutString = () => {
    const payload = decodeLayoutPayload(layoutString);
    if (!payload) {
      setLayoutError(t('layoutInvalid', 'Invalid layout string'));
      return;
    }
    useOverlayStore.getState().applyLayoutPayload(payload);
    setLayoutError('');
  };

  const handleCopyLayout = async () => {
    if (!layoutString) {
      handleGenerateLayoutString();
    }
    const toCopy = layoutString || encodeLayoutPayload(createLayoutPayload(useOverlayStore.getState()));
    try {
      await navigator.clipboard?.writeText(toCopy);
      toast.success(t('copiedToClipboard', 'Copied to clipboard'));
    } catch {
      setLayoutError(t('layoutCopyFailed', 'Could not copy to clipboard'));
    }
  };

  const handleSaveCurrentLayout = () => {
    setSaveLayoutName('');
    setSaveLayoutError('');
    setIsSaveLayoutDialogOpen(true);
  };

  const handleConfirmSaveLayout = () => {
    const name = saveLayoutName.trim();
    if (!name) {
      setSaveLayoutError(t('layoutNameRequired', 'Please enter a layout name'));
      return;
    }
    const payload = createLayoutPayload(useOverlayStore.getState());
    const encoded = encodeLayoutPayload(payload);
    if (!encoded) return;
    saveLayout(name, encoded);
    toast.success(t('layoutSaved', 'Layout saved'));
    setIsSaveLayoutDialogOpen(false);
    setSaveLayoutName('');
    setSaveLayoutError('');
  };

  const handleApplySavedLayout = (layoutId) => {
    setSelectedLayoutId(layoutId);
    const entry = (savedLayouts || []).find((layout) => layout.id === layoutId);
    if (!entry?.layoutString) return;
    const payload = decodeLayoutPayload(entry.layoutString);
    if (!payload) {
      toast.error(t('layoutInvalid', 'Invalid layout string'));
      return;
    }
    useOverlayStore.getState().applyLayoutPayload(payload);
  };

  const handleDeleteSavedLayout = (layoutId) => {
    const entry = (savedLayouts || []).find((layout) => layout.id === layoutId);
    if (!entry) return;
    const confirmed = window.confirm(t('layoutDeleteConfirm', `Delete layout "${entry.name}"?`));
    if (!confirmed) return;
    deleteSavedLayout(layoutId);
    if (selectedLayoutId === layoutId) setSelectedLayoutId('');
  };

  const handleObsOverlayToggle = () => {
    const next = !transparentBackground;
    setTransparentBackground(next);
    if (next) {
      resetCanvasView();
      setSidebarOpen(false);
      setSidebarVisible(false);
    }
  };
  
  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-2 overflow-x-hidden w-full box-border">
      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('resolution', 'Resolution')}
        </label>
        <Select value={resolution} onValueChange={(v) => setResolution(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(RESOLUTION_PRESETS).map(res => (
              <SelectItem key={res} value={res}>
                {res}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {resolution === 'custom' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-sidebar-foreground/60 mb-1 block">{t('width', 'Width')}</label>
            <Input 
              type="number"
              value={customResolution.width}
              onChange={(e) => setCustomResolution(parseInt(e.target.value) || 1920, customResolution.height)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-sidebar-foreground/60 mb-1 block">{t('height', 'Height')}</label>
            <Input 
              type="number"
              value={customResolution.height}
              onChange={(e) => setCustomResolution(customResolution.width, parseInt(e.target.value) || 1080)}
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('language', 'Language')}
        </label>
        <Select value={language} onValueChange={(value) => setLanguage(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">EN</SelectItem>
            <SelectItem value="ru">RU</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      
      {/* Grid Enable/Disable - master switch */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-sidebar-foreground/80">
            {t('enableGridSnapping', 'Enable Grid & Snapping')}
          </label>
          <button
            onClick={() => setGridEnabled(!gridEnabled)}
            className={cn(
              "p-2 rounded-md transition-colors",
              gridEnabled ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground"
            )}
          >
            {gridEnabled ? <Grid3X3 size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
        <p className="text-[10px] text-sidebar-foreground/50">
          {gridEnabled 
            ? t('gridActive', 'Grid and snapping are active')
            : t('gridDisabled', 'Grid and snapping are disabled')
          }
        </p>
      </div>
      
      {/* Grid settings - only show when grid is enabled */}
      {gridEnabled && (
        <>
          <div>
            <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
              {t('gridSize', 'Grid Size (px)')}
            </label>
            <Input 
              type="number"
              min={1}
              max={50}
              value={gridSize}
              onChange={(e) => setGridSize(parseInt(e.target.value) || 10)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-sidebar-foreground/80">
              {t('showGridLines', 'Show Grid Lines')}
            </label>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={cn(
                "p-2 rounded-md transition-colors",
                showGrid ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground"
              )}
            >
              {showGrid ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
        </>
      )}
      
      <Separator />
      
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-sidebar-foreground/80">
            {t('obsOverlayMode', 'OBS Overlay Mode')}
          </label>
          <button
            onClick={handleObsOverlayToggle}
            className={cn(
              "p-2 rounded-md transition-colors",
              transparentBackground ? "bg-green-600 text-white" : "bg-sidebar-accent text-sidebar-foreground"
            )}
          >
            {transparentBackground ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
        <p className="text-[10px] text-sidebar-foreground/50">
          {transparentBackground 
            ? t('obsOverlayOn', 'ON: Background transparent, reference image hidden')
            : t('obsOverlayOff', 'OFF: Normal editor mode with visible background')
          }
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 pr-2">
          <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
            {t('obsAutoHideLabels', 'Auto-hide labels in OBS')}
          </label>
          <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
            {t('obsAutoHideLabelsHint', 'Hide label text when OBS mode is enabled')}
          </p>
        </div>
        <Switch
          checked={obsHideLabels}
          onCheckedChange={setObsHideLabels}
        />
      </div>
      
      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('referenceImage', 'Reference Image')}
        </label>
        <div className="flex flex-col gap-2">
          <Input 
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="text-xs"
          />
          {backgroundImageUrl && (
            <button
              onClick={() => setBackgroundImageUrl(null)}
              className="text-xs text-destructive hover:text-destructive/80 text-left"
            >
              {t('removeImage', 'Remove image')}
            </button>
          )}
        </div>
        <p className="text-[10px] text-sidebar-foreground/40 mt-1">
          {t('referenceHint', 'Upload a game screenshot to use as reference')}
        </p>
      </div>
      
      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('iconScale', 'Icon Scale')}: {iconScale.toFixed(1)}x
        </label>
        <Input 
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={iconScale}
          onChange={(e) => setIconScale(parseFloat(e.target.value))}
        />
        <div className="flex justify-between text-[10px] text-sidebar-foreground/40 mt-1">
          <span>0.5x</span>
          <span>3x</span>
        </div>
      </div>
      
      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('iconSource', 'Icon Source')}
        </label>
        <Select value={iconSource} onValueChange={(v) => setIconSource(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cdn">{t('iconSourceCdn', 'CDN (Game Server)')}</SelectItem>
            <SelectItem value="local">{t('iconSourceLocal', 'Local')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-sidebar-foreground/40 mt-1">
          {iconSource === 'local' 
            ? t('iconSourceHintLocal', 'Using bundled icons from Game Icons folder')
            : t('iconSourceHintCdn', 'Using icons from game CDN (requires internet)')
          }
        </p>
      </div>

      <Separator />

      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('historySteps', 'History Steps')}: {historyLimit}
        </label>
        <Input
          type="range"
          min="5"
          max="20"
          step="1"
          value={historyLimit}
          onChange={(e) => setHistoryLimit(parseInt(e.target.value, 10))}
        />
        <div className="flex justify-between text-[10px] text-sidebar-foreground/40 mt-1">
          <span>5</span>
          <span>20</span>
        </div>
        <p className="text-[10px] text-sidebar-foreground/40 mt-1">
          {t('historyHint', 'Undo/redo history size (Ctrl+Z / Ctrl+Y)')}
        </p>
      </div>
      
      <Separator />
      
      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('spectatorMode', 'Spectator Mode')}
        </label>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-sidebar-foreground/60">{t('autoDetectSpectator', 'Auto-detect spectator mode')}</span>
          <button
            onClick={() => setAutoSpectatorMode(!autoSpectatorMode)}
            className={cn(
              "p-2 rounded-md transition-colors",
              autoSpectatorMode ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground"
            )}
          >
            {autoSpectatorMode ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
        <div className="text-[10px] text-sidebar-foreground/40">
          {isSpectator ? (
            <span className="text-yellow-400">{t('spectating', 'Spectating (P1/P2 labels)')}</span>
          ) : (
            <span className="text-green-400">{t('playing', 'Playing (You/Enemy labels)')}</span>
          )}
          {activeRoom && (
            <div className="mt-1 text-sidebar-foreground/30">
              {t('roomLabel', 'Room')}: {activeRoom.substring(0, 8)}...
            </div>
          )}
        </div>
      </div>
      
      <Separator />
      
      {/* Timer Settings */}
      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('timerDirection', 'Timer Direction')}
        </label>
        <Select value={timeFlowDirection} onValueChange={(v) => setTimeFlowDirection(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="elapsed">{t('timerCountUp', 'Count Up (Elapsed)')}</SelectItem>
            <SelectItem value="remaining">{t('timerCountDown', 'Count Down (Remaining)')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-sidebar-foreground/40 mt-1">
          {timeFlowDirection === 'remaining' 
            ? `${t('timerHintRemaining', 'Countdown to time limit')}${seasonInfo?.timeLimit ? ` (${Math.floor(seasonInfo.timeLimit / 60)}min)` : ''}`
            : t('timerHintElapsed', 'Shows actual run time (excluding pause)')
          }
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('statFormat', 'Stat Formatting')}
        </label>
        <Select value={statPlainFormat} onValueChange={(value) => setStatPlainFormat(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round">{t('statFormatRound', 'Round down (integer)')}</SelectItem>
            <SelectItem value="decimal">{t('statFormatDecimal', 'Two decimal places')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-sidebar-foreground/40 mt-1">
          {t('statFormatHint', 'Applies only to plain values (no x or %)')}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 pr-2">
          <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
            {t('globalBlurOnMatchEnd', 'Global blur on match end')}
          </label>
          <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
            {t('globalBlurOnMatchEndHint', 'Apply blur-on-end to all elements')}
          </p>
        </div>
        <Switch
          checked={globalBlurOnMatchEnd}
          onCheckedChange={setGlobalBlurOnMatchEnd}
        />
      </div>

      <Separator />

      <div>
        <label className="text-xs font-medium text-sidebar-foreground/80 mb-2 block">
          {t('sessionGamesLimit', 'Session games to show')}: {sessionGameDisplayLimit}
        </label>
        <Input
          type="range"
          min="1"
          max="20"
          step="1"
          value={sessionGameDisplayLimit}
          onChange={(e) => setSessionGameDisplayLimit(parseInt(e.target.value, 10) || 10)}
        />
        <div className="flex justify-between text-[10px] text-sidebar-foreground/40 mt-1">
          <span>1</span>
          <span>20</span>
        </div>
        <p className="text-[10px] text-sidebar-foreground/40 mt-1">
          {t('sessionGamesLimitHint', 'Controls how many recent session games are shown')}
        </p>
      </div>
      
      {/* Sidebar Auto-Hide Toggle */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 pr-2">
          <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
            {t('sidebarAutoHide', 'Sidebar Auto-Hide')}
          </label>
          <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
            {t('sidebarAutoHideHint', 'Hide sidebar after 3s of inactivity')}
          </p>
        </div>
        <Switch
          checked={sidebarAutoHide}
          onCheckedChange={setSidebarAutoHide}
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 pr-2">
          <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
            {t('showClippingWarnings', 'Show clipping warnings')}
          </label>
          <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
            {t('showClippingWarningsHint', 'Warn when element content overflows its bounds')}
          </p>
        </div>
        <Switch
          checked={showClippingWarnings}
          onCheckedChange={setShowClippingWarnings}
        />
      </div>

      <Separator />

      <div>
        <div className="text-xs font-medium text-sidebar-foreground/80 mb-2">
          {t('advancedSettings', 'Advanced Settings')}
        </div>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
              {t('enableAdvancedSettings', 'Enable Advanced Settings')}
            </label>
            <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
              {t('advancedHint', 'Show experimental and fine-tuning controls')}
            </p>
          </div>
          <Switch
            checked={advancedSettingsEnabled}
            onCheckedChange={setAdvancedSettingsEnabled}
          />
        </div>

        {advancedSettingsEnabled && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <label className="flex gap-2 text-xs font-medium text-sidebar-foreground/80 leading-snug">
                  {t('enableSmartInteractions', 'Enable Smart Interactions')} <FlaskConical size={14}/>
                </label>
                <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
                  {t('enableSmartInteractionsHint', 'Show smart interaction elements and settings')}
                </p>
              </div>
              <Switch
                checked={smartInteractionsEnabled}
                onCheckedChange={setSmartInteractionsEnabled}
              />
            </div>

            {smartInteractionsEnabled && (
              <>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
                  Show unreliable data in Smart Stats
                </label>
                <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
                  Enable extra stat changes beyond the curated list.
                </p>
              </div>
              <Switch
                checked={showUnreliableStats}
                onCheckedChange={setShowUnreliableStats}
              />
            </div>

            <Collapsible defaultOpen={false} className="w-full">
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/80 flex-1 text-left">
                  Smart Stats Variables
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {availableStatKeys?.length || 0}
                </Badge>
                <ChevronDown size={14} className="text-sidebar-foreground/40 shrink-0" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className={cn(
                  "flex flex-col gap-1 mt-1",
                  !showUnreliableStats && "opacity-50 pointer-events-none"
                )}>
                  {(availableStatKeys || []).map((statKey) => (
                    <div
                      key={statKey}
                      className="flex items-center justify-between p-2 rounded hover:bg-sidebar-accent/30"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs text-sidebar-foreground/80">
                          {STAT_CONFIG?.[statKey]?.label || statKey}
                        </span>
                        <span className="text-[10px] text-sidebar-foreground/40">
                          {statKey}
                        </span>
                      </div>
                      <Switch
                        checked={!!statVisibility?.[statKey]}
                        onCheckedChange={() => toggleStatVisibility(statKey)}
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
              </>
            )}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
                  {t('showIconOutlines', 'Show Icon Outlines & Fills')}
                </label>
                <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
                  {t('showIconOutlinesHint', 'Toggle borders, glow, and background fills')}
                </p>
              </div>
              <Switch
                checked={showElementOutlines}
                onCheckedChange={setShowElementOutlines}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
                  {t('allowUserSelect', 'Allow Text/Image Selection')}
                </label>
                <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
                  {t('allowUserSelectHint', 'Enable selecting text or dragging images')}
                </p>
              </div>
              <Switch
                checked={allowUserSelect}
                onCheckedChange={setAllowUserSelect}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
                  {t('hideElementTitles', 'Hide Element Titles')}
                </label>
                <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
                  {t('hideElementTitlesHint', 'Disable titles on all elements')}
                </p>
              </div>
              <Switch
                checked={hideElementTitles}
                onCheckedChange={setHideElementTitles}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <label className="text-xs font-medium text-sidebar-foreground/80 leading-snug">
                  {t('fakeGameData', 'Fake Game Data')}
                </label>
                <p className="text-[10px] text-sidebar-foreground/40 leading-snug break-words">
                  {t('fakeGameDataHint', 'Override live data with spoofed values')}
                </p>
              </div>
              <Switch
                checked={spoofEnabled}
                onCheckedChange={setSpoofEnabled}
              />
            </div>

            {spoofEnabled && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 0, label: t('common', 'Common') },
                    { key: 1, label: t('rare', 'Rare') },
                    { key: 2, label: t('epic', 'Epic') },
                    { key: 3, label: t('legendary', 'Legendary') },
                  ].map((entry) => {
                    const max = itemPoolByRarity[entry.key]?.length || 0;
                    return (
                      <div key={entry.key} className="flex flex-col gap-1">
                        <label className="text-[10px] text-sidebar-foreground/60">
                          {entry.label} (0–{max})
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={max}
                          value={spoofItemCounts?.[entry.key] ?? 0}
                          onChange={(e) => {
                            const next = Math.max(0, Math.min(parseInt(e.target.value, 10) || 0, max));
                            setSpoofItemCounts({
                              ...(spoofItemCounts || { 0: 0, 1: 0, 2: 0, 3: 0 }),
                              [entry.key]: next,
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-sidebar-foreground/60">
                      {t('spoofTimeDiff', 'Time Diff (sec)')}
                    </label>
                    <Input
                      type="number"
                      step="1"
                      value={spoofDiffs?.timeSeconds ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const next = raw === '' ? null : Number(raw);
                        setSpoofDiffs({
                          ...(spoofDiffs || { timeSeconds: null, difficulty: null, kills: null }),
                          timeSeconds: Number.isFinite(next) ? next : null,
                        });
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-sidebar-foreground/60">
                      {t('spoofDifficultyDiff', 'Difficulty Diff')}
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={spoofDiffs?.difficulty ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const next = raw === '' ? null : Number(raw);
                        setSpoofDiffs({
                          ...(spoofDiffs || { timeSeconds: null, difficulty: null, kills: null }),
                          difficulty: Number.isFinite(next) ? next : null,
                        });
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-sidebar-foreground/60">
                      {t('spoofKillDiff', 'Kill Diff')}
                    </label>
                    <Input
                      type="number"
                      step="1"
                      value={spoofDiffs?.kills ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const next = raw === '' ? null : Number(raw);
                        setSpoofDiffs({
                          ...(spoofDiffs || { timeSeconds: null, difficulty: null, kills: null }),
                          kills: Number.isFinite(next) ? next : null,
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-sidebar-foreground/60">
                    {t('spoofStageHistory', 'Spoof Stage History')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((playerId) => (
                      <div key={playerId} className="flex flex-col gap-2 rounded-md border border-sidebar-border/50 p-2">
                        <div className="text-[10px] text-sidebar-foreground/70">
                          {t('playerLabel', 'Player')} {playerId}
                        </div>
                        {[1, 2, 3].map((stageNumber) => (
                          <div key={stageNumber} className="grid grid-cols-3 gap-2">
                            <Input
                              type="number"
                              min={0}
                              placeholder={`${t('stageLabel', 'Stage')} ${stageNumber} ${t('time', 'Time')} (s)`}
                              value={spoofStageHistory?.[playerId]?.[stageNumber]?.timeSeconds ?? ''}
                              onChange={(e) => updateSpoofStageEntry(playerId, stageNumber, 'timeSeconds', e.target.value)}
                            />
                            <Input
                              type="number"
                              min={0}
                              placeholder={`${t('stageLabel', 'Stage')} ${stageNumber} ${t('kills', 'Kills')}`}
                              value={spoofStageHistory?.[playerId]?.[stageNumber]?.kills ?? ''}
                              onChange={(e) => updateSpoofStageEntry(playerId, stageNumber, 'kills', e.target.value)}
                            />
                            <Input
                              type="number"
                              min={0}
                              placeholder={`${t('stageLabel', 'Stage')} ${stageNumber} ${t('difficulty', 'Difficulty')} %`}
                              value={spoofStageHistory?.[playerId]?.[stageNumber]?.difficultyPercent ?? ''}
                              onChange={(e) => updateSpoofStageEntry(playerId, stageNumber, 'difficultyPercent', e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-sidebar-foreground/40">
                    {t('spoofStageHistoryHint', 'Enter exit time (seconds) and kill count for stages 1–3.')}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-sidebar-foreground/40">
                    {t('generateSpoofHint', 'Generate random test data for players')}
                  </p>
                  <Button size="sm" variant="secondary" onClick={handleGenerateSpoofData}>
                    {t('generate', 'Generate')}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-sidebar-foreground/60">
                      {t('spoofSessionGames', 'Session games')}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      value={spoofSessionGamesCount}
                      onChange={(e) => setSpoofSessionGamesCount(Math.max(0, Math.min(parseInt(e.target.value, 10) || 0, 40)))}
                      className="w-20"
                    />
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleGenerateSpoofSessionGames}>
                    {t('generateSessionGames', 'Generate Session')}
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-sidebar-foreground/60">
                    {t('spoofMatchState', 'Matchmaking State')}
                  </label>
                  <Select
                    value={spoofMatchState}
                    onValueChange={(value) => {
                      setSpoofMatchState(value);
                      applySpoofMatchState(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idle">{t('idle', 'Idle')}</SelectItem>
                      <SelectItem value="searching">{t('searchingMatch', 'Searching for Match')}</SelectItem>
                      <SelectItem value="match_found">{t('matchFound', 'Match Found')}</SelectItem>
                      <SelectItem value="accept_pending">{t('waitingOpponent', 'Waiting for Opponent')}</SelectItem>
                      <SelectItem value="match_confirmed">{t('matchConfirmed', 'Match Confirmed')}</SelectItem>
                      <SelectItem value="ban_selection">{t('banSelection', 'Ban Selection')}</SelectItem>
                      <SelectItem value="waiting_opponent">{t('waitingOpponentData', 'Waiting for opponent data')}</SelectItem>
                      <SelectItem value="game">{t('inGame', 'In Game')}</SelectItem>
                      <SelectItem value="ended">{t('matchEnded', 'Match Ended')}</SelectItem>
                      <SelectItem value="cancelled">{t('matchCancelled', 'Match Cancelled')}</SelectItem>
                      <SelectItem value="p1_death">{t('p1Death', 'P1 Death (Game Ongoing)')}</SelectItem>
                      <SelectItem value="p2_death">{t('p2Death', 'P2 Death (Game Ongoing)')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-sidebar-foreground/40">
                    {t('spoofMatchStateHint', 'Select a matchmaking phase for UI preview')}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-sidebar-foreground/40">
                    {t('spoofBansHint', 'Generate fake bans for the room')}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRoomBans(buildFakeRoomBans())}
                  >
                    {t('generateBans', 'Generate Bans')}
                  </Button>
                </div>
                {smartInteractionsEnabled && displaySettings?.debugLogging && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-sidebar-foreground/60">
                      Debug: Fire Smart Interaction Events
                    </label>
                    <div className="flex gap-2">
                      <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(INTERACTION_TYPES).map(type => (
                            <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => fireDebugEvent(1, selectedEventType)}>Fire P1</Button>
                      <Button size="sm" onClick={() => fireDebugEvent(2, selectedEventType)}>Fire P2</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <Separator />
      
      <div>
        <div className="text-xs font-medium text-sidebar-foreground/80 mb-2">
          {t('placedElements', 'Placed Elements')} ({elements.length})
        </div>
        {elements.length === 0 ? (
          <div className="text-xs text-sidebar-foreground/40 italic">
            {t('noElementsPlaced', 'No elements placed yet')}
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-40 overflow-auto">
            {elements.map(el => {
              const config = ELEMENT_TYPES.find(e => e.type === el.type);
              return (
                <div
                  key={el.id}
                  className="flex items-center justify-between gap-2 p-2 rounded bg-sidebar-accent/50 text-xs"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-sidebar-foreground truncate">
                      {getElementLabel(el.type, config?.label || el.type)}
                    </div>
                    <div className="text-[10px] text-sidebar-foreground/50">
                      {t('playerLabel', 'Player')} {el.playerId}
                    </div>
                  </div>
                  <button
                    onClick={() => removeElement(el.id)}
                    className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground"
                    title={t('removeElement', 'Remove Element')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Smart Interactions Settings - Only show if experimental features are enabled */}
      {advancedSettingsEnabled && smartInteractionsEnabled && (
        <>
          <SmartInteractionsSettings />
          <Separator />
        </>
      )}

      <div>
        <div className="text-xs font-medium text-sidebar-foreground/80 mb-2">
          {t('savedLayouts', 'Saved Layouts')}
        </div>
        <div className="flex flex-col gap-2">
          {(savedLayouts || []).length === 0 ? (
            <div className="text-xs text-sidebar-foreground/50 italic">
              {t('noSavedLayouts', 'No saved layouts')}
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-40 overflow-auto">
              {(savedLayouts || []).map((layout) => (
                <div
                  key={layout.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border p-2",
                    selectedLayoutId === layout.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-sidebar-border bg-sidebar-accent/40"
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-sidebar-foreground truncate">
                      {layout.name}
                    </div>
                    <div className="text-[10px] text-sidebar-foreground/50">
                      {t('layoutUpdated', 'Updated')} {new Date(layout.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleApplySavedLayout(layout.id)}
                    >
                      {t('apply', 'Apply')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => handleDeleteSavedLayout(layout.id)}
                    >
                      {t('delete', 'Delete')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={handleSaveCurrentLayout}>
            {t('saveCurrent', 'Save current')}
          </Button>
        </div>
      </div>

      <Dialog open={isSaveLayoutDialogOpen} onOpenChange={setIsSaveLayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('saveLayout', 'Save Layout')}</DialogTitle>
            <DialogDescription>
              {t('saveLayoutHint', 'Give this layout a name so you can re-use it later.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={saveLayoutName}
              onChange={(event) => {
                setSaveLayoutName(event.target.value);
                if (saveLayoutError) setSaveLayoutError('');
              }}
              placeholder={t('layoutNamePlaceholder', 'My layout')}
            />
            {saveLayoutError && (
              <div className="text-[10px] text-red-400">{saveLayoutError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsSaveLayoutDialogOpen(false)}>
              {t('dialogCancel', 'Cancel')}
            </Button>
            <Button onClick={handleConfirmSaveLayout}>
              {t('dialogSave', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-sidebar-foreground/80">
          {t('layoutSharing', 'Layout Sharing')}
        </div>
        <p className="text-[10px] text-sidebar-foreground/40">
          {t('layoutSharingHint', 'Copy a shareable layout string or paste one to apply a layout.')}
        </p>
        <textarea
          className="min-h-[90px] w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 p-2 text-[10px] text-sidebar-foreground/80 outline-none"
          value={layoutString}
          onChange={(event) => setLayoutString(event.target.value)}
          placeholder={t('layoutPlaceholder', 'Paste layout string here')}
        />
        {layoutError && (
          <div className="text-[10px] text-red-400">
            {layoutError}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={handleGenerateLayoutString}>
            {t('layoutGenerate', 'Generate')}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleCopyLayout}>
            {t('layoutCopy', 'Copy')}
          </Button>
          <Button size="sm" onClick={handleApplyLayoutString}>
            {t('layoutApply', 'Apply')}
          </Button>
        </div>
      </div>

      <Separator />

      <div>
        <div className="text-xs font-medium text-sidebar-foreground/80 mb-2">
          {t('elementGroups', 'Element Groups')} ({groups.length})
        </div>
        {groups.length === 0 ? (
          <div className="text-xs text-sidebar-foreground/40 italic">
            {t('noGroups', 'No groups yet')}
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-32 overflow-auto">
            {groups.map(group => (
              <div
                key={group.id}
                className="flex items-center justify-between gap-2 p-2 rounded bg-purple-500/20 border border-purple-500/30 text-xs"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-sidebar-foreground truncate">
                      Group {String(group.id).slice(0, 6)}
                  </div>
                  <div className="text-[10px] text-sidebar-foreground/50">
                      {(group.elementIds?.length ?? 0)} {t('elementsCount', 'elements')}
                  </div>
                </div>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="p-1 rounded hover:bg-purple-500/20 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                    title={t('ungroup', 'Ungroup')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-sidebar-foreground/50 mt-2">
          {t('rightClickGroupHint', 'Right-click elements to group/ungroup. Groups move together.')}
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-2 items-center justify-between text-md text-sidebar-foreground/50">
        <div className="flex items-center gap-1">
          <span>{t('withLove', 'With')}</span>
          <Heart size={18} strokeWidth={3} absoluteStrokeWidth className="text-[#CD1010]" />
          <span>{t('byOxCone', 'by OxCone')}</span>
        </div>
        <a
          href="https://github.com/OxCone1/Megabonk-Overlay"
          className="p-2 rounded-md hover:bg-sidebar-accent/80 text-sidebar-foreground/80 hover:text-sidebar-foreground"
          title={t('githubLink', 'GitHub')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={18} strokeWidth={2} absoluteStrokeWidth/>
        </a>
      </div>
    </div>
  );
}

export function OverlaySidebar() {
  const { 
    sidebarOpen, 
    setSidebarOpen, 
    sidebarVisible, 
    setSidebarVisible,
    setSelectedPlayerId,
    isDragging,
    getPlayerLabel,
    sidebarAutoHide,
    addElementsFromPayload,
    settingsSyncMode,
    setSettingsSyncMode,
    transparentBackground,
    setTransparentBackground,
    resetCanvasView,
  } = useOverlayStore();

  const { t } = useI18n();
  
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(0);
  
  // useTransition for smooth tab switching without blocking UI
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState('player1');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importTargetPlayerId, setImportTargetPlayerId] = useState(1);
  const [importString, setImportString] = useState('');
  const [importError, setImportError] = useState('');
  
  // Handle tab change with transition for better performance
  const handleTabChange = useCallback((value) => {
    startTransition(() => {
      setActiveTab(value);
      if (value === 'player1') setSelectedPlayerId(1);
      else if (value === 'player2') setSelectedPlayerId(2);
    });
  }, [setSelectedPlayerId]);
  
  // Initialize activity ref on first render
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);
  
  // Handle sidebar toggle with transition for smoother animation
  const handleSidebarToggle = useCallback((open) => {
    startTransition(() => {
      setSidebarOpen(open);
    });
  }, [setSidebarOpen]);

  // Force sidebar closed in OBS overlay mode
  useEffect(() => {
    if (!transparentBackground) return;
    setSidebarOpen(false);
    setSidebarVisible(false);
  }, [transparentBackground, setSidebarOpen, setSidebarVisible]);
  
  // Auto-hide sidebar when element is being dragged
  useEffect(() => {
    if (transparentBackground) return;
    if (isDragging && sidebarOpen) {
      handleSidebarToggle(false);
    }
  }, [isDragging, sidebarOpen, handleSidebarToggle, transparentBackground]);
  
  // Click outside handler - auto-hide sidebar when clicking outside
  useEffect(() => {
    if (transparentBackground) return;
    const handleClickOutside = (event) => {
      // Check if click is outside the sidebar
      const sidebarElement = document.querySelector('[data-sidebar="true"]');
      const triggerElement = document.querySelector('[data-sidebar-trigger="true"]');
      
      if (sidebarOpen && 
          sidebarElement && 
          !sidebarElement.contains(event.target) &&
          (!triggerElement || !triggerElement.contains(event.target))) {
        handleSidebarToggle(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen, setSidebarOpen, handleSidebarToggle, transparentBackground]);
  
  // Auto-hide sidebar after 3 seconds of inactivity when open (only if sidebarAutoHide is enabled)
  useEffect(() => {
    if (transparentBackground || !sidebarOpen || !sidebarAutoHide) return;
    
    const checkIdle = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 3000) {
        setSidebarOpen(false);
        setSidebarVisible(false);
      }
    };
    
    const idleInterval = setInterval(checkIdle, 500);
    return () => clearInterval(idleInterval);
  }, [sidebarOpen, setSidebarOpen, setSidebarVisible, sidebarAutoHide, transparentBackground]);
  
  // Track mouse activity within sidebar
  const handleSidebarActivity = useCallback(() => {
    if (transparentBackground) return;
    lastActivityRef.current = Date.now();
  }, [transparentBackground]);

  const handleSettingsSyncHeaderToggle = useCallback(() => {
    const nextMode = settingsSyncMode === 'off'
      ? 'upload'
      : settingsSyncMode === 'upload'
        ? 'download'
        : 'off';
    setSettingsSyncMode(nextMode);
  }, [settingsSyncMode, setSettingsSyncMode]);

  const handleObsOverlayHeaderToggle = useCallback(() => {
    const next = !transparentBackground;
    setTransparentBackground(next);
    if (next) {
      resetCanvasView();
      setSidebarOpen(false);
      setSidebarVisible(false);
    }
  }, [transparentBackground, setTransparentBackground, resetCanvasView, setSidebarOpen, setSidebarVisible]);

  const openImportDialog = useCallback((playerId) => {
    setImportTargetPlayerId(playerId);
    setImportString('');
    setImportError('');
    setIsImportDialogOpen(true);
  }, []);

  const handleImportSubmit = useCallback(() => {
    const payload = decodeLayoutPayload(importString);
    if (!payload || !Array.isArray(payload.elements)) {
      setImportError(t('layoutInvalid', 'Invalid layout string'));
      return;
    }
    addElementsFromPayload(payload, importTargetPlayerId);
    setImportError('');
    setIsImportDialogOpen(false);
  }, [addElementsFromPayload, importString, importTargetPlayerId, t]);
  
  // NOTE: Global mouse listener for showing sidebar removed to fix CPU usage issues
  // Replaced with edge detection zone in JSX
  
  const handleTriggerZoneHover = useCallback(() => {
    if (transparentBackground) return;
    setSidebarVisible(true);
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const shouldAutoHideTrigger = sidebarAutoHide || transparentBackground;
    const triggerHideDelay = transparentBackground ? 1500 : 3000;
    // Only auto-hide trigger if auto-hide is enabled or OBS overlay mode is active
    if (shouldAutoHideTrigger) {
      timeoutRef.current = setTimeout(() => {
        if (!useOverlayStore.getState().sidebarOpen) {
          setSidebarVisible(false);
        }
      }, triggerHideDelay);
    }
  }, [setSidebarVisible, sidebarAutoHide, transparentBackground]);

  useEffect(() => {
    if (transparentBackground || !sidebarVisible || sidebarOpen) return;
    const idleDelay = transparentBackground ? 1500 : 3000;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current > idleDelay) {
        setSidebarVisible(false);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [sidebarVisible, sidebarOpen, transparentBackground, setSidebarVisible]);
  
  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={handleSidebarToggle}
      className="w-0 min-w-0 flex-none"
    >
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addElements', 'Add elements')}</DialogTitle>
            <DialogDescription>
              {t('addElementsHint', 'Paste an exported elements string to add those items to the canvas.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <textarea
              className="min-h-[120px] w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 p-2 text-[10px] text-sidebar-foreground/80 outline-none"
              value={importString}
              onChange={(event) => setImportString(event.target.value)}
              placeholder={t('layoutPlaceholder', 'Paste layout string here')}
            />
            {importError && (
              <div className="text-[10px] text-red-400">{importError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsImportDialogOpen(false)}>
              {t('dialogCancel', 'Cancel')}
            </Button>
            <Button onClick={handleImportSubmit}>{t('dialogAdd', 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!transparentBackground && (
        <>
          {/* Edge trigger zone - replaces global mouse move listener */}
          <div 
            className="fixed left-0 top-0 bottom-0 w-8 z-40 bg-transparent"
            onMouseEnter={handleTriggerZoneHover}
          />

          {/* Trigger button that appears on mouse activity */}
          <div 
            data-sidebar-trigger="true"
            className={cn(
              "fixed left-4 top-1/2 -translate-y-1/2 z-50 transition-opacity duration-300",
              sidebarVisible && !sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <button
              onClick={() => handleSidebarToggle(true)}
              className="p-3 bg-primary rounded-full shadow-lg hover:bg-primary/90 transition-colors"
            >
              <Grid3X3 size={20} className="text-primary-foreground" />
            </button>
          </div>
        </>
      )}
      
      {!transparentBackground && (
        <Sidebar 
          data-sidebar="true"
          className={cn(
            "border-r border-sidebar-border",
            isPending && "opacity-80" // Visual feedback during transitions
          )}
          onMouseDown={handleSidebarActivity}
          onKeyDown={handleSidebarActivity}
        >
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Grid3X3 size={20} className="text-primary" />
                <span className="font-semibold">{t('overlayEditor', 'Overlay Editor')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSettingsSyncHeaderToggle}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    settingsSyncMode === 'off'
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : settingsSyncMode === 'upload'
                        ? "bg-primary text-primary-foreground"
                        : "bg-emerald-500 text-emerald-50"
                  )}
                  title={
                    settingsSyncMode === 'off'
                      ? t('settingsSyncOff', 'Settings sync: off')
                      : settingsSyncMode === 'upload'
                        ? t('settingsSyncUpload', 'Settings sync: upload')
                        : t('settingsSyncDownload', 'Settings sync: download')
                  }
                >
                  {settingsSyncMode === 'off' ? (
                    <CloudOff size={16} />
                  ) : settingsSyncMode === 'upload' ? (
                    <CloudUpload size={16} />
                  ) : (
                    <CloudDownload size={16} />
                  )}
                </button>
                <button
                  onClick={handleObsOverlayHeaderToggle}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    transparentBackground ? "bg-green-600 text-white" : "bg-sidebar-accent text-sidebar-foreground"
                  )}
                  title={
                    transparentBackground
                      ? t('obsOverlayOn', 'OBS Overlay Mode: on')
                      : t('obsOverlayOff', 'OBS Overlay Mode: off')
                  }
                >
                  {transparentBackground ? <Pause size={16} /> : <Play size={16} />}
                </button>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid grid-cols-3 mt-2 w-full px-2 box-border">
                <TabsTrigger 
                  value="player1" 
                  className="text-xs px-1 flex-1 min-w-0"
                >
                  <User size={14} className="shrink-0" />
                  <span className="truncate">{getPlayerLabel(1)}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="player2" 
                  className="text-xs px-1 flex-1 min-w-0"
                >
                  <Users size={14} className="shrink-0" />
                  <span className="truncate">{getPlayerLabel(2)}</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs px-1 flex-1 min-w-0">
                  <Settings size={14} className="shrink-0" />
                  <span className="truncate">{t('settings', 'Settings')}</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Tab content with pending state indicator */}
              <div className={cn("transition-opacity", isPending && "opacity-60")}>
                <TabsContent value="player1" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-180px)] w-full overflow-x-hidden">
                    <div className="px-2 pb-2 w-full box-border">
                      <div className="flex items-center justify-between mb-2 px-2">
                        <div className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider w-fit">
                          {getPlayerLabel(1)} {t('playerElements', 'Elements')}
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => openImportDialog(1)}>
                          {t('addElements', 'Add elements')}
                        </Button>
                      </div>
                      <ElementPalette playerId={1} />
                      <PlayerRunEndSettings playerId={1} />
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="player2" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-180px)] w-full overflow-x-hidden">
                    <div className="px-2 pb-2 w-full box-border">
                      <div className="flex items-center justify-between mb-2 px-2">
                        <div className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider w-fit">
                          {getPlayerLabel(2)} {t('playerElements', 'Elements')}
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => openImportDialog(2)}>
                          {t('addElements', 'Add elements')}
                        </Button>
                      </div>
                      <ElementPalette playerId={2} />
                      <PlayerRunEndSettings playerId={2} />
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="settings" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-180px)] w-full overflow-x-hidden">
                    <SettingsPanel />
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </SidebarContent>
          
          <SidebarFooter className="border-t border-sidebar-border p-3">
            <div className="text-xs text-sidebar-foreground/40 text-center">
              {t('dragElementsHint', 'Drag elements to canvas or click + to add')}
            </div>
          </SidebarFooter>
        </Sidebar>
      )}
    </SidebarProvider>
  );
}
