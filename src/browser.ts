/**
 * Detects whether the current browser is running on macOS.
 * @returns True if the browser is running on macOS, false otherwise.
 */
export function isMacOS(): boolean {
    const uaData = (navigator as any).userAgentData;
    if (uaData?.platform) {
        return uaData.platform === 'macOS';
    }

    return /Mac|iPhone|iPod|iPad/i.test(navigator.platform ?? navigator.userAgent);
}

/**
 * Detects whether the current browser is running on Windows.
 * @returns True if the browser is running on Windows, false otherwise.
 */
export function isWindows(): boolean {
    const uaData = (navigator as any).userAgentData;
    if (uaData?.platform) {
        return uaData.platform === 'Windows';
    }

    const platform = navigator.platform ?? '';
    return /^Win/i.test(platform) || /Windows/i.test(navigator.userAgent);
}

/**
 * Detects whether the current browser is using Webkit or Blink engine.
 * @returns True if the browser is using Webkit or Blink engine, false otherwise.
 */
export function isWebkitDescendant(): boolean {
  return /AppleWebKit/i.test(navigator.userAgent);
}
