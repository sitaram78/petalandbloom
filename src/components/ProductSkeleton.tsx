import React from 'react';

export default function ProductSkeleton() {
  return (
    <div className="group block relative animate-pulse">
      <div className="relative overflow-hidden bg-silk/30 rounded-sm">
        <div className="aspect-[4/5] bg-silk/50" />
      </div>
      <div className="mt-4 space-y-3">
        <div className="h-6 w-3/4 bg-silk/50 rounded-sm" />
        <div className="h-4 w-full bg-silk/30 rounded-sm" />
        <div className="h-4 w-1/3 bg-silk/30 rounded-sm mt-4" />
      </div>
    </div>
  );
}
