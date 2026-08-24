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
