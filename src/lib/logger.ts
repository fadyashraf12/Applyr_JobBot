export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[Error in ${context}]:`, error);
  } else {
    // In production, log a single clean JSON line to stdout instead of leaking stack traces or raw console dumps
    console.log(JSON.stringify({
      level: 'error',
      context,
      message,
      timestamp: new Date().toISOString()
    }));
  }
}

export function isGoogleAuthError(err: any): boolean {
  if (!err) return false;
  const errMsg = String(err.message || err).toLowerCase();
  return (
    errMsg.includes('google oauth') ||
    errMsg.includes('refresh token') ||
    errMsg.includes('invalid_grant') ||
    errMsg.includes('access_token') ||
    errMsg.includes('google connection') ||
    errMsg.includes('decryption') ||
    errMsg.includes('decrypt') ||
    errMsg.includes('oauth')
  );
}
