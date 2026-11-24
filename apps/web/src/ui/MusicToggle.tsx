import { useEffect, useState } from 'react';
import { music } from '../lib/music';
import { Icon } from './Icon';

/** Round music on/off button; a small equaliser bounces while the music plays. */
export function MusicToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(music.enabled);
  const [playing, setPlaying] = useState(music.playing);
  useEffect(() => music.subscribe(() => { setOn(music.enabled); setPlaying(music.playing); }), []);
  return (
    <button className={`music-toggle ${on ? 'is-on' : ''} ${playing ? 'is-playing' : ''} ${className}`}
      onClick={() => music.setEnabled(!on)} aria-pressed={on} aria-label={on ? 'Music on. Turn music off' : 'Music off. Turn music on'}>
      <Icon name={on ? 'music-on' : 'music-off'} size={20} />
      {playing && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}
    </button>
  );
}
