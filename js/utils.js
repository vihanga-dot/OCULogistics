// Shared Utility Functions
// Single source of truth for escaping/sanitizing/URL-safety/notifications —
// previously duplicated in main.js, admin.js, articles.js.

/**
 * Escape HTML to prevent XSS when injecting user content into innerHTML.
 * @param {*} value
 * @returns {string}
 */
export function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

/**
 * Validate a URL is http/https (and optionally restricted to an allowlist of
 * hostnames) before it's ever placed in an href attribute. Falls back to '#'.
 * @param {string} url
 * @param {string[]} [allowedHosts] - optional list of allowed hostnames (suffix match)
 * @returns {string}
 */
export function safeUrl(url, allowedHosts = null) {
    if (!url) return '#';
    try {
        const parsed = new URL(url, window.location.origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '#';

        if (allowedHosts && allowedHosts.length) {
            const host = parsed.hostname.toLowerCase();
            const ok = allowedHosts.some(allowed =>
                host === allowed || host.endsWith('.' + allowed)
            );
            if (!ok) return '#';
        }

        return parsed.href;
    } catch {
        return '#';
    }
}

// Known-good hosts for the two link fields that are labeled as a specific
// service in the admin form (driveLink -> Google Drive, facebookLink -> Facebook).
export const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com'];
export const FACEBOOK_HOSTS = ['facebook.com', 'fb.com', 'fb.watch'];

/**
 * Show a transient toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type]
 */
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideLeft 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
