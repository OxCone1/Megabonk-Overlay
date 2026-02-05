import { create } from 'zustand';

// Import local image map for offline icons
import imageMap from '../../image_map.json';

// Normalize local icon paths to match actual public folder casing
const FOLDER_CASE_MAP = {
  heroes: 'Heroes',
  weapons: 'Weapons',
  tomes: 'Tomes',
  items: 'Items',
  interface: 'Interface',
};

function normalizeLocalImagePath(imageSrc) {
  if (!imageSrc || typeof imageSrc !== 'string') return imageSrc;
  if (!imageSrc.startsWith('/Game Icons/')) return imageSrc;

  const parts = imageSrc.split('/');
  // parts: ['', 'Game Icons', '<folder>', 'rest...']
  if (parts.length < 4) return imageSrc;

  const folder = parts[2];
  const normalizedFolder = FOLDER_CASE_MAP[folder] || FOLDER_CASE_MAP[folder?.toLowerCase()] || folder;
  parts[2] = normalizedFolder;

  const normalizedPath = parts.join('/');
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
    ? import.meta.env.BASE_URL
    : '/';
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const trimmed = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
  return `${base}${trimmed}`;
}

export const useGameDataStore = create((set, get) => ({
  heroes: [],
  weapons: [],
  tomes: [],
  items: [],
  isLoaded: false,
  
  // Local image map (loaded from JSON)
  localImageMap: imageMap,
  
  setHeroes: (heroes) => set({ heroes }),
  setWeapons: (weapons) => set({ weapons }),
  setTomes: (tomes) => set({ tomes }),
  setItems: (items) => set({ items }),
  setLoaded: (isLoaded) => set({ isLoaded }),
  
  getHeroByIngameId: (ingameId) => {
    return get().heroes.find(h => h.ingameId === ingameId);
  },
  
  getWeaponByIngameId: (ingameId) => {
    return get().weapons.find(w => w.ingameId === ingameId);
  },
  
  getTomeByIngameId: (ingameId) => {
    return get().tomes.find(t => t.ingameId === ingameId);
  },
  
  getItemByIngameId: (ingameId) => {
    return get().items.find(i => i.ingameId === ingameId);
  },
  
  getItemsByRarity: (rarity) => {
    return get().items.filter(i => i.rarity === rarity);
  },
  
  // Local image map getters
  getLocalHeroByIngameId: (ingameId) => {
    const hero = get().localImageMap.heroes?.find(h => h.ingameId === ingameId);
    if (!hero) return hero;
    return { ...hero, imageSrc: normalizeLocalImagePath(hero.imageSrc) };
  },
  
  getLocalWeaponByIngameId: (ingameId) => {
    const weapon = get().localImageMap.weapons?.find(w => w.ingameId === ingameId);
    if (!weapon) return weapon;
    return { ...weapon, imageSrc: normalizeLocalImagePath(weapon.imageSrc) };
  },
  
  getLocalTomeByIngameId: (ingameId) => {
    const tome = get().localImageMap.tomes?.find(t => t.ingameId === ingameId);
    if (!tome) return tome;
    return { ...tome, imageSrc: normalizeLocalImagePath(tome.imageSrc) };
  },
  
  getLocalItemByIngameId: (ingameId) => {
    const item = get().localImageMap.items?.find(i => i.ingameId === ingameId);
    if (!item) return item;
    return { ...item, imageSrc: normalizeLocalImagePath(item.imageSrc) };
  },

  getHeroWeaponIngameId: (heroIngameId) => {
    const state = get();
    const localHero = state.localImageMap.heroes?.find(h => h.ingameId === heroIngameId) || null;
    const apiHero = state.heroes?.find(h => h.ingameId === heroIngameId) || null;
    const hero = localHero || apiHero;
    if (!hero) return heroIngameId;

    const weaponId = hero.weaponId ?? hero.weapon_id ?? null;
    if (!weaponId) return heroIngameId;

    const localWeapon = state.localImageMap.weapons?.find(w => w.id === weaponId) || null;
    const apiWeapon = state.weapons?.find(w => w.id === weaponId || w.ingameId === weaponId) || null;
    return localWeapon?.ingameId ?? apiWeapon?.ingameId ?? weaponId ?? heroIngameId;
  },
}));
