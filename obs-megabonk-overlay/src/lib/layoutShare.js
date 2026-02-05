import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

const LAYOUT_PREFIX = 'MB1:';

const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const roundNumber = (value, decimals = 2) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const trimArray = (arr) => {
  if (!Array.isArray(arr)) return arr;
  let end = arr.length;
  while (end > 0 && (arr[end - 1] === undefined || arr[end - 1] === null)) {
    end -= 1;
  }
  return arr.slice(0, end);
};

const minifyElement = (element) => {
  if (!element || typeof element !== 'object') return element;
  const next = { ...element };

  if (next.position) {
    next.position = {
      ...next.position,
      x: roundNumber(next.position.x),
      y: roundNumber(next.position.y),
    };
  }

  if (next.size) {
    next.size = {
      ...next.size,
      width: roundNumber(next.size.width),
      height: roundNumber(next.size.height),
    };
  }

  if (typeof next.scale === 'number') next.scale = roundNumber(next.scale, 3);
  if (typeof next.opacity === 'number') next.opacity = roundNumber(next.opacity, 3);
  if (typeof next.zIndex === 'number') next.zIndex = Math.round(next.zIndex);

  if (next.layout) {
    next.layout = {
      ...next.layout,
      gapX: roundNumber(next.layout.gapX),
      gapY: roundNumber(next.layout.gapY),
    };
    if (next.layout.baseSize) {
      next.layout.baseSize = {
        ...next.layout.baseSize,
        width: roundNumber(next.layout.baseSize.width),
        height: roundNumber(next.layout.baseSize.height),
      };
    }
  }

  return next;
};

const minifyPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload };

  if (next.customResolution) {
    next.customResolution = {
      ...next.customResolution,
      width: Math.round(next.customResolution.width ?? 0),
      height: Math.round(next.customResolution.height ?? 0),
    };
  }

  if (Array.isArray(next.elements)) {
    next.elements = next.elements.map(minifyElement);
  }

  return next;
};

const compactLayout = (layout) => {
  if (!layout) return undefined;
  const compact = [
    layout.align,
    layout.flow,
    layout.itemsOrder,
    layout.lockScale,
    layout.lockOriginalSize,
    layout.gapX !== undefined ? roundNumber(layout.gapX) : undefined,
    layout.gapY !== undefined ? roundNumber(layout.gapY) : undefined,
    layout.baseSize ? [roundNumber(layout.baseSize.width), roundNumber(layout.baseSize.height)] : undefined,
    layout.rarityLimits,
    layout.visibleFields,
    layout.fillColor,
    layout.hideTitle,
    layout.hideLabel,
    layout.labelOverride,
    layout.labelOverrideUpdatedAt,
    layout.eventPlacement,
    layout.textColor,
    layout.obsVisibility,
    layout.obsVisibilityPhases,
  ];
  return trimArray(compact);
};

const compactElement = (element) => {
  if (!element || typeof element !== 'object') return null;
  const compact = [
    element.type,
    element.position ? [roundNumber(element.position.x), roundNumber(element.position.y)] : undefined,
    element.size ? [roundNumber(element.size.width), roundNumber(element.size.height)] : undefined,
    typeof element.scale === 'number' ? roundNumber(element.scale, 3) : undefined,
    typeof element.opacity === 'number' ? roundNumber(element.opacity, 3) : undefined,
    typeof element.zIndex === 'number' ? Math.round(element.zIndex) : undefined,
    element.playerId !== undefined ? element.playerId : undefined,
    compactLayout(element.layout),
  ];

  return trimArray(compact);
};

const compactGroups = (groups, indexMap) => (
  (groups || []).map((group) => ([
    group.name || 'Group',
    (group.elementIds || []).map((id) => indexMap.get(id)).filter((idx) => idx !== undefined),
  ])).filter((group) => group[1].length >= 2)
);

const compactPayload = (payload) => {
  const base = minifyPayload(payload);
  const elements = Array.isArray(base.elements) ? base.elements.filter(Boolean) : [];
  const compactElements = elements.map(compactElement).filter(Boolean);
  const indexMap = new Map(elements.map((el, index) => [el.id, index]));
  const compactGroupsList = compactGroups(base.groups, indexMap);

  if (base.mode === 'elements') {
    return trimArray([
      2,
      'e',
      compactElements,
      compactGroupsList,
    ]);
  }

  return trimArray([
    2,
    'l',
    base.resolution,
    base.customResolution ? [base.customResolution.width, base.customResolution.height] : undefined,
    compactElements,
    compactGroupsList,
    base.iconScale,
    base.iconSource,
    base.gridEnabled,
    base.showGrid,
    base.gridSize,
    base.transparentBackground,
  ]);
};

const expandLayout = (layout) => {
  if (!layout) return undefined;
  if (Array.isArray(layout)) {
    const [a, f, io, ls, lo, gx, gy, bs, rl, vf, fc, ht, hl, loLabel, loUpdated, ep, tc, ov, ovp] = layout;
    const expanded = {};
    if (a !== undefined) expanded.align = a;
    if (f !== undefined) expanded.flow = f;
    if (io !== undefined) expanded.itemsOrder = io;
    if (ls !== undefined) expanded.lockScale = ls;
    if (lo !== undefined) expanded.lockOriginalSize = lo;
    if (gx !== undefined) expanded.gapX = gx;
    if (gy !== undefined) expanded.gapY = gy;
    if (Array.isArray(bs)) expanded.baseSize = { width: bs[0], height: bs[1] };
    if (rl !== undefined) expanded.rarityLimits = rl;
    if (vf !== undefined) expanded.visibleFields = vf;
    if (fc !== undefined) expanded.fillColor = fc;
    if (ht !== undefined) expanded.hideTitle = ht;
    if (hl !== undefined) expanded.hideLabel = hl;
    if (loLabel !== undefined) expanded.labelOverride = loLabel;
    if (loUpdated !== undefined) expanded.labelOverrideUpdatedAt = loUpdated;
    if (ep !== undefined) expanded.eventPlacement = ep;
    if (tc !== undefined) expanded.textColor = tc;
    if (ov !== undefined) expanded.obsVisibility = ov;
    if (ovp !== undefined) expanded.obsVisibilityPhases = ovp;
    return expanded;
  }

  const expanded = {};
  if (layout.a !== undefined) expanded.align = layout.a;
  if (layout.f !== undefined) expanded.flow = layout.f;
  if (layout.io !== undefined) expanded.itemsOrder = layout.io;
  if (layout.ls !== undefined) expanded.lockScale = layout.ls;
  if (layout.lo !== undefined) expanded.lockOriginalSize = layout.lo;
  if (layout.gx !== undefined) expanded.gapX = layout.gx;
  if (layout.gy !== undefined) expanded.gapY = layout.gy;
  if (Array.isArray(layout.bs)) expanded.baseSize = { width: layout.bs[0], height: layout.bs[1] };
  if (layout.rl !== undefined) expanded.rarityLimits = layout.rl;
  if (layout.vf !== undefined) expanded.visibleFields = layout.vf;
  if (layout.fc !== undefined) expanded.fillColor = layout.fc;
  if (layout.ht !== undefined) expanded.hideTitle = layout.ht;
  if (layout.hl !== undefined) expanded.hideLabel = layout.hl;
  if (layout.loLabel !== undefined) expanded.labelOverride = layout.loLabel;
  if (layout.loUpdated !== undefined) expanded.labelOverrideUpdatedAt = layout.loUpdated;
  if (layout.ep !== undefined) expanded.eventPlacement = layout.ep;
  if (layout.tc !== undefined) expanded.textColor = layout.tc;
  if (layout.ov !== undefined) expanded.obsVisibility = layout.ov;
  if (layout.ovp !== undefined) expanded.obsVisibilityPhases = layout.ovp;
  return expanded;
};

const expandElement = (compact) => {
  if (!compact || (typeof compact !== 'object' && !Array.isArray(compact))) return null;

  const [t, p, s, sc, o, z, pl, l] = Array.isArray(compact)
    ? compact
    : [compact.t, compact.p, compact.s, compact.sc, compact.o, compact.z, compact.pl, compact.l];

  const element = {
    id: generateId('element'),
    type: t,
  };

  if (Array.isArray(p)) element.position = { x: p[0], y: p[1] };
  if (Array.isArray(s)) element.size = { width: s[0], height: s[1] };
  if (sc !== undefined) element.scale = sc;
  if (o !== undefined) element.opacity = o;
  if (z !== undefined) element.zIndex = z;
  if (pl !== undefined) element.playerId = pl;

  const layout = expandLayout(l);
  if (layout && Object.keys(layout).length > 0) {
    element.layout = layout;
  }

  return element;
};

const expandPayload = (payload) => {
  if (!payload || (typeof payload !== 'object' && !Array.isArray(payload))) return null;

  const isArrayPayload = Array.isArray(payload);
  const mode = isArrayPayload ? payload[1] : payload.m;
  if (mode !== 'l' && mode !== 'e') return payload;

  const elementSource = isArrayPayload
    ? (mode === 'e' ? payload[2] : payload[4])
    : payload.e;
  const elements = Array.isArray(elementSource)
    ? elementSource.map(expandElement).filter(Boolean)
    : [];
  const idMap = elements.map((el) => el.id);
  const rawGroups = isArrayPayload
    ? (mode === 'e' ? payload[3] : payload[5])
    : payload.g;
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map((group) => {
      const name = Array.isArray(group) ? group[0] : group.n;
      const ids = Array.isArray(group) ? group[1] : group.e;
      return {
        id: generateId('group'),
        name: name || 'Group',
        elementIds: (ids || []).map((idx) => idMap[idx]).filter(Boolean),
      };
    }).filter((group) => group.elementIds.length >= 2)
    : [];

  if (mode === 'e') {
    const version = isArrayPayload ? payload[0] : payload.v || 1;
    return {
      version,
      mode: 'elements',
      elements,
      groups,
    };
  }

  if (isArrayPayload) {
    const [, , resolution, customResolution, , , iconScale, iconSource, gridEnabled, showGrid, gridSize, transparentBackground] = payload;
    return {
      version: payload[0] || 1,
      mode: 'layout',
      resolution,
      customResolution: customResolution ? { width: customResolution[0], height: customResolution[1] } : undefined,
      elements,
      groups,
      iconScale,
      iconSource,
      gridEnabled,
      showGrid,
      gridSize,
      transparentBackground,
    };
  }

  return {
    version: payload.v || 1,
    mode: 'layout',
    resolution: payload.r,
    customResolution: payload.cr ? { width: payload.cr[0], height: payload.cr[1] } : undefined,
    elements,
    groups,
    iconScale: payload.is,
    iconSource: payload.io,
    gridEnabled: payload.ge,
    showGrid: payload.sg,
    gridSize: payload.gs,
    transparentBackground: payload.tb,
  };
};

export function createLayoutPayload(state) {
  return {
    version: 1,
    mode: 'layout',
    resolution: state.resolution,
    customResolution: state.customResolution,
    elements: state.elements,
    groups: state.groups,
    iconScale: state.iconScale,
    iconSource: state.iconSource,
    gridEnabled: state.gridEnabled,
    showGrid: state.showGrid,
    gridSize: state.gridSize,
    transparentBackground: state.transparentBackground,
  };
}

export function createElementsPayload({ elements, groups }) {
  return {
    version: 1,
    mode: 'elements',
    elements: elements || [],
    groups: groups || [],
  };
}

export function encodeLayoutPayload(payload) {
  try {
    const json = JSON.stringify(compactPayload(payload));
    const compressed = compressToEncodedURIComponent(json);
    return `${LAYOUT_PREFIX}${compressed}`;
  } catch {
    return '';
  }
}

export function decodeLayoutPayload(value) {
  if (!value || typeof value !== 'string') return null;

  try {
    const trimmed = value.trim();
    if (trimmed.startsWith(LAYOUT_PREFIX)) {
      const encoded = trimmed.slice(LAYOUT_PREFIX.length);
      const json = decompressFromEncodedURIComponent(encoded);
      if (!json) return null;
      const parsed = JSON.parse(json);
      return expandPayload(parsed);
    }

    // Allow raw JSON as fallback
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      return expandPayload(parsed);
    }
  } catch {
    return null;
  }

  return null;
}