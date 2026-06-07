import React from 'react';

interface EmptyStateProps {
  /** Emoji or lucide icon shown in the circle. */
  glyph: React.ReactNode;
  title: string;
  subtitle: string;
  cta?: { label: string; onClick: () => void };
  /** Use the subtle (secondary) button style instead of the primary blue. */
  secondaryCta?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ glyph, title, subtitle, cta, secondaryCta }) => (
  <div className="card-base p-8 text-center flex flex-col items-center animate-scale-in">
    <div className="w-16 h-16 rounded-full bg-electric-blue/10 flex items-center justify-center mb-4 text-3xl">
      {glyph}
    </div>
    <p className="text-text-primary font-bold text-lg">{title}</p>
    <p className="text-text-secondary text-sm mt-1 max-w-xs">{subtitle}</p>
    {cta && (
      <button
        onClick={cta.onClick}
        className={`mt-5 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
          secondaryCta
            ? 'bg-navy-accent text-text-secondary hover:text-electric-blue'
            : 'bg-electric-blue text-white hover:bg-electric-blue/90'
        }`}
      >
        {cta.label}
      </button>
    )}
  </div>
);

export default EmptyState;
