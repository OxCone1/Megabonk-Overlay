import { useOverlayStore } from '@/stores/overlayStore';
import { Pause } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { resolvePublicAssetPath } from '@/lib/publicAsset';

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function GameTimeElement({ playerId }) {
  const { getPlayerState, seasonInfo, timeFlowDirection } = useOverlayStore();
  const { t } = useI18n();
  const playerState = getPlayerState(playerId);
  
  if (!playerState) {
    return (
      <div className="p-3 flex flex-col items-center justify-center h-full obs-hide-shadow">
        <div className="text-2xl font-alagard text-white/40 alagard-numeric">--:--</div>
        <div className="text-xs text-white/40 obs-hide-in-overlay">{t('noData', 'No data')}</div>
      </div>
    );
  }
  
  const { timeElapsed, isPaused, pauseTime } = playerState;
  
  // Calculate actual run time (timeElapsed includes pause time, so subtract it)
  const actualRunTime = Math.max(0, timeElapsed - pauseTime);
  
  // Calculate remaining time if we have a time limit
  const timeLimit = seasonInfo?.timeLimit || 0;
  const remainingTime = timeLimit > 0 ? Math.max(0, timeLimit - actualRunTime) : 0;
  
  // Choose which time to display based on flow direction
  const displayTime = timeFlowDirection === 'remaining' && timeLimit > 0 
    ? remainingTime 
    : actualRunTime;
  
  return (
    <div className="p-3 flex flex-col items-center justify-center h-full">
      <div className="flex items-center gap-3 w-full">
        <img 
          src={resolvePublicAssetPath('/Game Icons/Interface/time.png')} 
          alt="Time" 
          className="w-7 h-7 object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className={`text-[36px] font-alagard tabular-nums alagard-numeric drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] ${isPaused ? 'text-white/70' : 'text-white'}`}>
          {formatTime(displayTime)}
        </div>
      </div>

      <div className={`flex items-center gap-2 translate-y-[-40%] ${isPaused ? 'text-yellow-400' : 'text-white/50'}`}>
        <Pause size={12} />
        <span className="text-lg tabular-nums alagard-numeric drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          {formatTime(pauseTime)}
        </span>
      </div>
    </div>
  );
}

export function PauseLimitElement() {
  const { seasonInfo } = useOverlayStore();
  const { t } = useI18n();
  const pauseLimit = seasonInfo?.pauseLimit;
  const isMissing = !pauseLimit;

  return (
    <div className={isMissing ? "p-2 flex items-center justify-center h-full obs-hide-shadow" : "p-2 flex items-center justify-center h-full"}>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-white/60 obs-hide-in-overlay">{t('pauseLimit', 'Pause Limit')}</span>
        <span className="text-xl font-bold text-cyan-400 tabular-nums alagard-numeric">
          {pauseLimit ? formatTime(pauseLimit) : '--:--'}
        </span>
      </div>
    </div>
  );
}

export function PauseRemainingElement({ playerId }) {
  const { getPlayerState, seasonInfo } = useOverlayStore();
  const { t } = useI18n();
  const playerState = getPlayerState(playerId);
  const isPaused = playerState?.isPaused;
  const pauseLimit = seasonInfo?.pauseLimit || 0;
  const pauseTime = playerState?.pauseTime || 0;
  // const remaining = Math.max(0, pauseLimit - pauseTime);
  const isMissing = pauseLimit <= 0;

  if (!playerState) {
    return (
      <div className="p-3 flex flex-col items-center justify-center h-full obs-hide-shadow">
        <div className="text-2xl font-alagard text-white/40 alagard-numeric">--:--</div>
        <div className="text-xs text-white/40 obs-hide-in-overlay">{t('noData', 'No data')}</div>
      </div>
    );
  }

  return (
    <div className={isMissing ? "p-3 flex flex-col items-center justify-center h-full obs-hide-shadow" : "p-3 flex flex-col items-center justify-center h-full"}>
      {/* <div className="flex items-center gap-3">
        <img
          src={resolvePublicAssetPath('/Game Icons/Interface/time.png')}
          alt="Pause Remaining"
          className="w-7 h-7 object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className={`text-[36px] font-alagard tabular-nums alagard-numeric drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] ${isPaused ? 'text-white/70' : 'text-white'}`}>
          {pauseLimit > 0 ? formatTime(remaining) : '--:--'}
        </div>
      </div> */}

      <div className={`flex items-center gap-2 ${isPaused ? 'text-yellow-400' : 'text-white/50'}`}>
        <Pause size={14} className='translate-y-[-10%]'/>
        <span className="text-xl tabular-nums alagard-numeric drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          {formatTime(pauseTime)}
        </span>
      </div>
    </div>
  );
}

export function GameLevelElement({ playerId }) {
  const { getPlayerState } = useOverlayStore();
  const { t } = useI18n();
  const playerState = getPlayerState(playerId);
  const level = playerState?.character?.level;
  const isMissing = level === undefined || level === null;
  
  return (
    <div className={isMissing ? "p-2 flex items-center justify-center h-full obs-hide-shadow" : "p-2 flex items-center justify-center h-full"}>
      <div className="flex items-center gap-2">
        <span className="text-2xl text-white">{t('lvlShort', 'LVL')}</span>
        <span className="text-2xl tabular-nums alagard-numeric">
          {level !== undefined && level !== null ? level : '--'}
        </span>
      </div>
    </div>
  );
}
