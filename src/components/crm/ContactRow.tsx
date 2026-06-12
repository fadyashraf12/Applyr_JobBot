import React, { useState } from 'react';

interface Contact {
  name: string;
  email: string;
  phone: string;
  role: string;
  notes: string;
}

interface ContactRowProps {
  contact: Contact;
  index: number;
  onUpdate: (index: number, updated: Contact) => void;
  onDelete: (index: number) => void;
}

export default function ContactRow({ contact, index, onUpdate, onDelete }: ContactRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState<Contact>({ ...contact });

  const handleSave = () => {
    onUpdate(index, edited);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Name</label>
            <input
              type="text"
              value={edited.name}
              onChange={(e) => setEdited({ ...edited, name: e.target.value })}
              className="w-full h-9 px-3 rounded bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Role / Job Title</label>
            <input
              type="text"
              value={edited.role}
              onChange={(e) => setEdited({ ...edited, role: e.target.value })}
              className="w-full h-9 px-3 rounded bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-none"
              placeholder="e.g. Lead Talent Acquisition"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Email</label>
            <input
              type="email"
              value={edited.email}
              onChange={(e) => setEdited({ ...edited, email: e.target.value })}
              className="w-full h-9 px-3 rounded bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Phone</label>
            <input
              type="text"
              value={edited.phone}
              onChange={(e) => setEdited({ ...edited, phone: e.target.value })}
              className="w-full h-9 px-3 rounded bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Notes</label>
          <textarea
            value={edited.notes}
            onChange={(e) => setEdited({ ...edited, notes: e.target.value })}
            rows={2}
            className="w-full p-2.5 rounded bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-none resize-none"
            placeholder="Key talking points or direct contact notes..."
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-900">
          <button
            onClick={() => {
              setEdited({ ...contact });
              setIsEditing(false);
            }}
            className="px-3 py-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded text-[11px] text-slate-300 transition-all cursor-pointer font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-[11px] text-white rounded transition-all cursor-pointer font-semibold"
          >
            Save Contact
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-850 p-4 rounded-xl flex items-start justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-white">{contact.name || 'Unnamed Recruiter'}</span>
          {contact.role && (
            <span className="text-[10px] bg-slate-800 font-semibold px-2 py-0.5 rounded text-slate-400">
              {contact.role}
            </span>
          )}
        </div>
        <div className="grid gap-1 sm:grid-cols-2 text-xs text-slate-400">
          {contact.email && (
            <span className="flex items-center gap-1.5 break-all">
              <span className="text-slate-550 select-none">✉️</span> {contact.email}
            </span>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1.5">
              <span className="text-slate-550 select-none">📞</span> {contact.phone}
            </span>
          )}
        </div>
        {contact.notes && (
          <p className="text-xs text-slate-300 italic bg-slate-950/20 p-2.5 rounded-lg border border-slate-850/40 mt-1 max-w-xl">
            "{contact.notes}"
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 transition-all font-semibold active:scale-95"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(index)}
          className="text-xs px-2.5 py-1.5 bg-red-950/20 hover:bg-red-900/20 border border-red-900/40 rounded text-red-400 hover:text-red-300 transition-all font-semibold active:scale-95"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
