import React from 'react';

interface DisplayNamePreviewProps {
  displayName?: string;
  username?: string;
}

export const DisplayNamePreview: React.FC<DisplayNamePreviewProps> = ({ displayName, username }) => {
  return (
    <div className="bg-gray-100 p-4 rounded-xl text-center">
      <p className="text-xs text-gray-500 mb-1">How your name will appear:</p>
      {displayName ? (
        <>
          <p className="text-xl font-bold text-gray-900">{displayName}</p>
          <p className="text-sm text-gray-500">@{username || 'username'}</p>
        </>
      ) : (
        <p className="text-xl font-bold text-gray-900">@{username || 'username'}</p>
      )}
    </div>
  );
};
