import React from 'react';

interface DisplayNamePreviewProps {
  displayName?: string;
  username?: string;
}

export const DisplayNamePreview: React.FC<DisplayNamePreviewProps> = ({ displayName, username }) => {
  return (
    <div className="bg-navy-accent p-4 rounded-xl text-center">
      <p className="text-xs text-text-secondary mb-1">How your name will appear:</p>
      {displayName ? (
        <>
          <p className="text-xl font-bold text-text-primary">{displayName}</p>
          <p className="text-sm text-text-secondary">@{username || 'username'}</p>
        </>
      ) : (
        <p className="text-xl font-bold text-text-primary">@{username || 'username'}</p>
      )}
    </div>
  );
};
