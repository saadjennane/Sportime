import React from 'react';
import logo from '../assets/logo.png';

/** Static Sportime logo with a spinning ring around it — the app's loading animation.
 *  `size` = ring diameter; the logo sits centered at ~60% of it. */
export const LogoSpinner: React.FC<{ size?: number; label?: string; fullscreen?: boolean }> = ({ size = 64, label, fullscreen }) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${fullscreen ? 'min-h-screen' : 'min-h-[50vh]'}`}>
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full border-[3px] border-electric-blue/20 border-t-electric-blue animate-spin"
        style={{ animationDuration: '0.9s' }}
      />
      <img src={logo} alt="" style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
    {label && <p className="text-text-secondary text-sm animate-pulse">{label}</p>}
  </div>
);

export default LogoSpinner;
