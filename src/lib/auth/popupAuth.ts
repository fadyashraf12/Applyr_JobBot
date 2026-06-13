/**
 * Popup-based Google OAuth authentication handler
 * Used for initial login flow on Vercel (where signInWithPopup fails)
 */

export interface PopupAuthResult {
  success: boolean;
  error?: string;
  uid?: string;
}

/**
 * Opens a popup window for Google OAuth authentication
 * Returns a promise that resolves when authentication completes
 */
export function openGoogleAuthPopup(): Promise<PopupAuthResult> {
  return new Promise((resolve) => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Open the popup window
    const popup = window.open(
      `/api/auth/google/login`,
      'google_auth_login',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
    );

    if (!popup) {
      resolve({
        success: false,
        error: 'Popup was blocked by the browser'
      });
      return;
    }

    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        window.removeEventListener('message', handleMessage);
        popup.close();
        
        // The popup has completed authentication
        // The Firebase client will detect the new user via onAuthStateChanged
        resolve({
          success: true
        });
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        window.removeEventListener('message', handleMessage);
        popup.close();
        
        resolve({
          success: false,
          error: event.data.error || 'Authentication failed'
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Timeout after 10 minutes
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      if (popup && !popup.closed) {
        popup.close();
      }
      resolve({
        success: false,
        error: 'Authentication timeout'
      });
    }, 10 * 60 * 1000);

    // Clean up timeout if popup closes
    const checkPopupClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkPopupClosed);
        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
      }
    }, 500);
  });
}
