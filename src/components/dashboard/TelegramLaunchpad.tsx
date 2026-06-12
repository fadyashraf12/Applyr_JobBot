import React, { useState } from 'react';

interface TelegramLaunchpadProps {
  uid: string;
}

export default function TelegramLaunchpad({ uid }: TelegramLaunchpadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ token: string; url: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGeneratePairingUrl = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/auth/pair-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate token.');
      }

      const botUsername = 'ApplyrBot'; // fallbacks to Spec requirements
      const pairingUrl = `https://t.me/${botUsername}?start=pair_${data.token}`;
      setTokenInfo({ token: data.token, url: pairingUrl });
      
      // Auto-open link in helper
      window.open(pairingUrl, '_blank');
    } catch (err: any) {
      console.error('Error in generating token:', err);
      setErrorMsg(err.message || 'Error generating link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>⚡</span> Set Up Bot Workspace
        </h3>
        <p className="text-xs text-slate-400 max-w-xl">
          Instantly connect your Telegram to this web dashboard with a temporary pairing token. You can then forward job listings directly to your virtual assistant.
        </p>
      </div>

      <div className="flex flex-col items-stretch md:items-end justify-center gap-2 shrink-0">
        <button
          onClick={handleGeneratePairingUrl}
          disabled={isLoading}
          className="h-10 px-5 inline-flex items-center justify-center font-semibold text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-550 text-white shadow-md shadow-indigo-600/10 transition-all active:scale-95 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Pairing...
            </span>
          ) : (
            '⚡ Launch Applyr on Telegram'
          )}
        </button>

        {tokenInfo && (
          <div className="text-right">
            <a
              href={tokenInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-indigo-400 font-mono underline hover:text-indigo-300 break-all leading-none block"
            >
              Click here if Telegram failed to open
            </a>
          </div>
        )}

        {errorMsg && (
          <span className="text-[10px] text-red-400 font-medium block">
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
}
