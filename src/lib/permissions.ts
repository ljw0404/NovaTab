export type PermStatus = 'granted' | 'denied' | 'no-extension';

const REQUIRED = ['bookmarks', 'history'] as const;

export function isExtensionContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    !!chrome.runtime &&
    !!chrome.runtime.id
  );
}

export async function checkPermissions(): Promise<PermStatus> {
  if (!isExtensionContext()) return 'no-extension';
  if (!chrome.permissions?.contains) return 'granted';
  return new Promise(resolve => {
    chrome.permissions.contains(
      { permissions: REQUIRED as unknown as string[] },
      ok => resolve(ok ? 'granted' : 'denied')
    );
  });
}

export async function requestPermissions(): Promise<boolean> {
  if (!isExtensionContext() || !chrome.permissions?.request) return false;
  return new Promise(resolve => {
    chrome.permissions.request(
      { permissions: REQUIRED as unknown as string[] },
      granted => resolve(!!granted)
    );
  });
}
