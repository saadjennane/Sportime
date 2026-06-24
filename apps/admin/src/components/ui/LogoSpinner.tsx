import logo from '../../assets/logo.png';

/** Static Sportime logo with a spinning ring around it — loading state. */
export function LogoSpinner({ size = 64, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
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
}
