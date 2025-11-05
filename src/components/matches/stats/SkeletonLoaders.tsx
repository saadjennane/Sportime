import React from 'react';

const SkeletonBox: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`bg-navy-accent animate-pulse rounded ${className}`} />
);

export const FormSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="bg-deep-navy/50 p-4 rounded-lg space-y-3">
      <SkeletonBox className="h-5 w-1/2" />
      <SkeletonBox className="h-8 w-full" />
      <div className="grid grid-cols-5 gap-2 pt-2 border-t border-disabled/50">
        <SkeletonBox className="h-10" />
        <SkeletonBox className="h-10" />
        <SkeletonBox className="h-10" />
        <SkeletonBox className="h-10" />
        <SkeletonBox className="h-10" />
      </div>
      <div className="space-y-2 pt-2 border-t border-disabled/50">
        {[...Array(5)].map((_, i) => <SkeletonBox key={i} className="h-8 w-full" />)}
      </div>
    </div>
    <div className="bg-deep-navy/50 p-4 rounded-lg space-y-3">
      <SkeletonBox className="h-5 w-1/2" />
      <SkeletonBox className="h-8 w-full" />
    </div>
  </div>
);

export const H2HSkeleton: React.FC = () => (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="bg-navy-accent p-3 rounded-lg flex items-center justify-between">
        <div className="space-y-1">
          <SkeletonBox className="h-3 w-16" />
          <SkeletonBox className="h-3 w-24" />
        </div>
        <SkeletonBox className="h-4 w-1/3" />
        <SkeletonBox className="h-6 w-12" />
      </div>
    ))}
  </div>
);

export const LineupSkeleton: React.FC = () => (
  <div className="space-y-4">
    <SkeletonBox className="h-16 w-full" />
    <div>
      <SkeletonBox className="h-4 w-1/4 mb-2" />
      <div className="bg-deep-navy/50 p-2 rounded-lg space-y-1">
        {[...Array(11)].map((_, i) => <SkeletonBox key={i} className="h-6 w-full" />)}
      </div>
    </div>
    <div>
      <SkeletonBox className="h-4 w-1/4 mb-2" />
      <div className="bg-deep-navy/50 p-2 rounded-lg space-y-1">
        {[...Array(4)].map((_, i) => <SkeletonBox key={i} className="h-6 w-full" />)}
      </div>
    </div>
  </div>
);
