import React, { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import ContactRow from './ContactRow';
import FollowUpDatePicker from './FollowUpDatePicker';

interface Contact {
  name: string;
  email: string;
  phone: string;
  role: string;
  notes: string;
}

interface Application {
  applicationId: string;
  company: string;
  jobTitle: string;
  status: 'pending' | 'interview' | 'offer' | 'rejected' | 'ghosted';
  appliedAt: any;
  followUpDate?: any;
  recruiterReplied?: boolean;
  lastReplyAt?: any;
  lastReplySnippet?: string | null;
  hrEmail?: string;
  emailSubject?: string;
  emailBody?: string;
  notes?: string;
  contacts?: Contact[];
  jobDescription?: string;
}

interface ApplicationDetailModalProps {
  uid: string;
  application: Application;
  onClose: () => void;
  onRefreshList?: () => void;
}

export default function ApplicationDetailModal({
  uid,
  application,
  onClose,
  onRefreshList,
}: ApplicationDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'email' | 'contacts' | 'notes' | 'timeline'>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // local editable state
  const [company, setCompany] = useState(application.company || '');
  const [jobTitle, setJobTitle] = useState(application.jobTitle || '');
  const [hrEmail, setHrEmail] = useState(application.hrEmail || '');
  const [notesVal, setNotesVal] = useState(application.notes || '');
  const [contacts, setContacts] = useState<Contact[]>(application.contacts || []);

  const appDocRef = doc(db, `users/${uid}/applications/${application.applicationId}`);

  const handleFieldChange = async (fieldName: string, value: any) => {
    setIsSaving(true);
    try {
      await updateDoc(appDocRef, {
        [fieldName]: value,
        updatedAt: new Date(),
      });
      if (onRefreshList) onRefreshList();
    } catch (err) {
      console.error(`Error saving field ${fieldName}:`, err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateContact = async (index: number, updatedContact: Contact) => {
    const updated = [...contacts];
    updated[index] = updatedContact;
    setContacts(updated);
    await handleFieldChange('contacts', updated);
  };

  const handleAddContact = async () => {
    const newContact: Contact = { name: '', role: '', email: '', phone: '', notes: '' };
    const updated = [...contacts, newContact];
    setContacts(updated);
    // Auto-update to Firestore so the user can edit it
    await handleFieldChange('contacts', updated);
  };

  const handleDeleteContact = async (index: number) => {
    const updated = contacts.filter((_, i) => i !== index);
    setContacts(updated);
    await handleFieldChange('contacts', updated);
  };

  const handleDeleteApplication = async () => {
    if (!window.confirm(`Are you completely sure you want to discard the application with ${application.company}? This is irreversible.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteDoc(appDocRef);
      if (onRefreshList) onRefreshList();
      onClose();
    } catch (err) {
      console.error('Error discarding application document:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (val: any) => {
    if (!val) return '—';
    const date = val.toDate ? val.toDate() : new Date(val);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />

      {/* Container Card */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl h-[650px] flex flex-col overflow-hidden shadow-2xl z-10">
        
        {/* Header toolbar */}
        <div className="p-6 border-b border-slate-850 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white tracking-tight overflow-hidden overflow-ellipsis whitespace-nowrap leading-tight">
              {company}
            </h3>
            <p className="text-xs text-slate-400 font-medium overflow-hidden overflow-ellipsis whitespace-nowrap mt-0.5">
              {jobTitle}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                <svg className="animate-spin h-3 w-3 text-indigo-450" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            )}
            <button
              onClick={handleDeleteApplication}
              disabled={isDeleting}
              className="text-xs text-rose-450 hover:text-rose-400 px-2.5 py-1.5 hover:bg-red-950/15 border border-transparent rounded-lg transition-all"
            >
              Discard Log
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white transition-all active:scale-95"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab selection bar */}
        <div className="px-6 border-b border-slate-850 flex items-center gap-1 shrink-0 overflow-x-auto bg-slate-950/20 select-none">
          {(['overview', 'email', 'contacts', 'notes', 'timeline'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-11 px-4 text-xs font-bold border-b-2 transition-all capitalize leading-none whitespace-nowrap ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-400 font-semibold bg-indigo-500/[0.02]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab scroll viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onBlur={() => handleFieldChange('company', company)}
                    className="w-full h-11 px-4 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-sm text-white font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Job Title / Role</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    onBlur={() => handleFieldChange('jobTitle', jobTitle)}
                    className="w-full h-11 px-4 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-sm text-white font-medium outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Hiring Contact Email</label>
                  <input
                    type="email"
                    value={hrEmail}
                    onChange={(e) => setHrEmail(e.target.value)}
                    onBlur={() => handleFieldChange('hrEmail', hrEmail)}
                    className="w-full h-11 px-4 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-sm text-white font-medium outline-none"
                    placeholder="e.g. hr@company.com"
                  />
                </div>
              </div>

              {application.jobDescription && (
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Job Description Text</label>
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-slate-400 text-xs leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap font-sans">
                    {application.jobDescription}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EMAIL / DOCUMENTATION */}
          {activeTab === 'email' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-550 leading-none">Email Subject</label>
                <p className="text-sm font-bold text-white border-b border-slate-850 pb-2">{application.emailSubject || '(No Subject Line Sent)'}</p>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-550 leading-none">Sent Email Body</label>
                <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                  {application.emailBody || '(No Letter Body Saved)'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Recruiters List</span>
                <button
                  onClick={handleAddContact}
                  className="text-xs px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500 text-white rounded font-semibold transition-all active:scale-95"
                >
                  Create Contact +
                </button>
              </div>

              {contacts.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-850 bg-slate-950/10 rounded-xl">
                  <p className="text-xs text-slate-500 italic">No direct hiring contacts created for this role yet.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {contacts.map((contact, idx) => (
                    <ContactRow
                      key={idx}
                      index={idx}
                      contact={contact}
                      onUpdate={handleUpdateContact}
                      onDelete={handleDeleteContact}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-widest leading-none">Custom Log Notes</label>
                <p className="text-xs text-slate-500">Record custom feedback, call notes, or follow up talking points.</p>
              </div>
              <textarea
                value={notesVal}
                onChange={(e) => setNotesVal(e.target.value)}
                onBlur={() => handleFieldChange('notes', notesVal)}
                rows={10}
                className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-all resize-none"
                placeholder="Take notes..."
              />
            </div>
          )}

          {/* TAB 5: TIMELINE & SCHEDULE */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <FollowUpDatePicker
                selectedDate={application.followUpDate}
                onChange={(newDate) => handleFieldChange('followUpDate', newDate)}
              />

              <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-xl space-y-4">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 leading-none">
                  Monitoring Webhooks & Deliveries
                </label>
                
                {application.recruiterReplied ? (
                  <div className="p-4 bg-indigo-950/30 border border-indigo-900/40 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-md shadow-indigo-300/30 animate-pulse"></span>
                        Recruiter Reply Registered
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {formatDate(application.lastReplyAt)}
                      </span>
                    </div>
                    {application.lastReplySnippet && (
                      <p className="text-xs text-slate-300 italic bg-slate-950/40 p-3 rounded border border-indigo-900/10">
                        "{application.lastReplySnippet}"
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-850 bg-slate-900/5 rounded-lg">
                    No replies or webhook alerts registered. System is scanning your connected Gmail thread for HR answers.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
