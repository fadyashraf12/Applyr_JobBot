import React from 'react';
import MetricCard from './MetricCard';

interface MetricsRowProps {
  total: number;
  pending: number;
  interviews: number;
}

export default function MetricsRow({ total, pending, interviews }: MetricsRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        label="Total Applications"
        value={total}
        icon="💼"
      />
      <MetricCard
        label="Pending Responses"
        value={pending}
        icon="⏳"
      />
      <MetricCard
        label="Interviews Slated"
        value={interviews}
        icon="🎯"
      />
    </div>
  );
}
