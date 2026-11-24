export const TRAINING_CONSENT_KEY = 'tichu6-training-consent-v1';
export const TRAINING_CONSENT_EVENT = 'tichu6-training-consent-changed';

let temporaryConsent: boolean | undefined;

export function readTrainingConsent(): boolean {
  if (temporaryConsent !== undefined) return temporaryConsent;
  try {
    const saved = localStorage.getItem(TRAINING_CONSENT_KEY);
    // New visitors default on; never overwrite an explicit opt-out.
    return saved === null || saved === 'true';
  } catch {
    return false;
  }
}

export function writeTrainingConsent(enabled: boolean): void {
  try {
    localStorage.setItem(TRAINING_CONSENT_KEY, String(enabled));
    temporaryConsent = undefined;
  } catch {
    // Honor withdrawal on this connection even when persistence is unavailable.
    temporaryConsent = enabled;
  }
  window.dispatchEvent(
    new CustomEvent(TRAINING_CONSENT_EVENT, { detail: { enabled } }),
  );
}
