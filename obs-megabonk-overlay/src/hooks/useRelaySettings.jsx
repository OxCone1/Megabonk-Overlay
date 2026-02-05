import { useEffect, useMemo, useRef } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { createLayoutPayload, encodeLayoutPayload, decodeLayoutPayload } from '@/lib/layoutShare';

const RELAY_URL = 'http://127.0.0.1:17502';

export function useRelaySettings() {
  const currentUserId = useOverlayStore((state) => state.currentUser_id);
  const settingsSyncMode = useOverlayStore((state) => state.settingsSyncMode);
  const elements = useOverlayStore((state) => state.elements);
  const groups = useOverlayStore((state) => state.groups);
  const resolution = useOverlayStore((state) => state.resolution);
  const customResolution = useOverlayStore((state) => state.customResolution);
  const iconScale = useOverlayStore((state) => state.iconScale);
  const iconSource = useOverlayStore((state) => state.iconSource);
  const gridEnabled = useOverlayStore((state) => state.gridEnabled);
  const showGrid = useOverlayStore((state) => state.showGrid);
  const gridSize = useOverlayStore((state) => state.gridSize);
  const transparentBackground = useOverlayStore((state) => state.transparentBackground);

  const lastSentRef = useRef('');
  const lastSentVersionRef = useRef(0);
  const lastRemoteVersionRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);
  const debounceRef = useRef(null);
  const pollRef = useRef(null);
  const modeChangedAtRef = useRef(Date.now());
  const downloadDelayRef = useRef(null);
  const uploadDelayRef = useRef(null);

  useEffect(() => {
    modeChangedAtRef.current = Date.now();
  }, [settingsSyncMode]);

  const layoutPayload = useMemo(() => ({
    resolution,
    customResolution,
    elements,
    groups,
    iconScale,
    iconSource,
    gridEnabled,
    showGrid,
    gridSize,
    transparentBackground,
  }), [
    resolution,
    customResolution,
    elements,
    groups,
    iconScale,
    iconSource,
    gridEnabled,
    showGrid,
    gridSize,
    transparentBackground,
  ]);

  useEffect(() => {
    if (!currentUserId || settingsSyncMode !== 'download') return;

    if (downloadDelayRef.current) {
      clearTimeout(downloadDelayRef.current);
      downloadDelayRef.current = null;
    }

    const fetchRemote = () => {
      fetch(`${RELAY_URL}/api/settings?userId=${encodeURIComponent(currentUserId)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          const layoutString = data?.layoutString || data?.settings?.layoutString;
          const version = Number(data?.version || data?.settings?.version || 0);
          if (!layoutString || !version) return;
          if (version === lastRemoteVersionRef.current) return;
          const payload = decodeLayoutPayload(layoutString);
          if (!payload) return;
          lastRemoteVersionRef.current = version;
          isApplyingRemoteRef.current = true;
          useOverlayStore.getState().applyLayoutPayload(payload);
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 0);
        })
        .catch(() => {});
    };

    const delay = Math.max(0, 5000 - (Date.now() - modeChangedAtRef.current));
    downloadDelayRef.current = setTimeout(() => {
      fetchRemote();
      pollRef.current = setInterval(fetchRemote, 10000);
    }, delay);

    return () => {
      if (downloadDelayRef.current) {
        clearTimeout(downloadDelayRef.current);
        downloadDelayRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [currentUserId, settingsSyncMode]);

  useEffect(() => {
    if (!currentUserId || settingsSyncMode !== 'upload') return;
    if (isApplyingRemoteRef.current) return;

    if (uploadDelayRef.current) {
      clearTimeout(uploadDelayRef.current);
      uploadDelayRef.current = null;
    }

    const scheduleUpload = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const payload = createLayoutPayload({
          resolution: layoutPayload.resolution,
          customResolution: layoutPayload.customResolution,
          elements: layoutPayload.elements,
          groups: layoutPayload.groups,
          iconScale: layoutPayload.iconScale,
          iconSource: layoutPayload.iconSource,
          gridEnabled: layoutPayload.gridEnabled,
          showGrid: layoutPayload.showGrid,
          gridSize: layoutPayload.gridSize,
          transparentBackground: layoutPayload.transparentBackground,
        });
        const encoded = encodeLayoutPayload(payload);
        if (!encoded || encoded === lastSentRef.current) return;
        lastSentRef.current = encoded;
        const version = Date.now();
        lastSentVersionRef.current = version;

        fetch(`${RELAY_URL}/api/settings?userId=${encodeURIComponent(currentUserId)}` , {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            layoutString: encoded,
            updatedAt: Date.now(),
            version,
          }),
        }).catch(() => {});
      }, 5000);
    };

    const delay = Math.max(0, 5000 - (Date.now() - modeChangedAtRef.current));
    uploadDelayRef.current = setTimeout(() => {
      scheduleUpload();
    }, delay);

    return () => {
      if (uploadDelayRef.current) {
        clearTimeout(uploadDelayRef.current);
        uploadDelayRef.current = null;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentUserId, layoutPayload, settingsSyncMode]);
}
