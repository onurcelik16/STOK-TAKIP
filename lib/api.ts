const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
export const API_URL = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

export function getAuthHeaders(): Record<string, string> {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export function getProxyImageUrl(url: string | null | undefined): string {
    if (!url) return '/placeholder.png';
    if (url.startsWith('http')) {
        return `${API_URL}/proxy/image?url=${encodeURIComponent(url)}`;
    }
    return url;
}
