import React from 'react';

export default function SkeletonLoader() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-category-title"></div>
      <div className="skeleton-card">
        <div className="skeleton-text skeleton-text-long"></div>
        <div className="skeleton-text skeleton-text-short"></div>
      </div>
      <div className="skeleton-card">
        <div className="skeleton-text skeleton-text-medium"></div>
        <div className="skeleton-text skeleton-text-short"></div>
      </div>
    </div>
  );
}
