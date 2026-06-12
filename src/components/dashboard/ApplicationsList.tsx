import React from 'react';
import ApplicationCard from './ApplicationCard';
import ApplicationsTable from './ApplicationsTable';

interface Application {
  applicationId: string;
  company: string;
  jobTitle: string;
  status: 'pending' | 'interview' | 'offer' | 'rejected' | 'ghosted';
  appliedAt: any;
  followUpDate?: any;
  recruiterReplied?: boolean;
}

interface ApplicationsListProps {
  applications: Application[];
  onUpdateStatus: (id: string, status: any) => void;
  onSelect: (id: string) => void;
}

export default function ApplicationsList({
  applications,
  onUpdateStatus,
  onSelect,
}: ApplicationsListProps) {
  if (applications.length === 0) {
    return (
      <div className="border border-dashed border-slate-800 bg-slate-900/5 p-12 text-center rounded-2xl max-w-lg mx-auto my-8">
        <div className="h-12 w-12 mx-auto rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-500 mb-4 select-none">
          <span>🚀</span>
        </div>
        <h4 className="font-bold text-slate-200 text-base">No Applications Tracked Yet</h4>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Open your private Telegram companion thread, complete your master profile uploads, and forward any listing to automate full PDF & mail assembly.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile view visible below 768px */}
      <div className="grid gap-4 md:hidden">
        {applications.map((app) => (
          <ApplicationCard
            key={app.applicationId}
            application={app}
            onUpdateStatus={onUpdateStatus}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Desktop view visible above 768px */}
      <div className="hidden md:block">
        <ApplicationsTable
          applications={applications}
          onUpdateStatus={onUpdateStatus}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
