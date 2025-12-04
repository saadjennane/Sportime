import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, title, value, footer, accentColor }) => {
  return (
    <div 
      className="card-base p-4 flex flex-col justify-between border-l-4"
      style={{ borderLeftColor: accentColor || 'var(--electric-blue)' }}
    >
      <div>
        <div className="flex items-center gap-2 text-text-secondary mb-2">
          {icon}
          <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
        </div>
        <div className="text-2xl md:text-3xl font-bold text-text-primary">
          {value}
        </div>
      </div>
      {footer && (
        <div className="text-xs text-text-disabled mt-2">
          {footer}
        </div>
      )}
    </div>
  );
};
