import { vi } from 'vitest';

export function stubChromiumMacOS() {
    vi.stubGlobal('navigator', {
        userAgentData: { platform: 'macOS' },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        platform: 'MacIntel',
    });
}

export function stubChromiumWindows() {
    vi.stubGlobal('navigator', {
        userAgentData: { platform: 'Windows' },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        platform: 'Win32',
    });
}

export function stubGenericBrowser() {
    vi.stubGlobal('navigator', {
        userAgentData: { platform: 'Unknown' },
        userAgent: 'Mozilla/5.0',
        platform: 'Unknown',
    });
}

function getPlatform(userAgentString: string): string {
    if (userAgentString.includes('Mac')) {
        return 'macOS'
    } else if (userAgentString.includes('Windows')) {
        return 'Windows'
    } else if (userAgentString.includes('Linux')) {
        return 'Linux'
    } else {
        return 'Unknown'
    }
}

export function stubBrowserUserAgent(userAgentString: string) {
    const platform = getPlatform(userAgentString);
    vi.stubGlobal('navigator', {
        userAgentData: { platform },
        userAgent: userAgentString,
        platform,
    });
}
