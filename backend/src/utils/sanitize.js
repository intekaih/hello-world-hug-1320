const sanitizeHtml = require('sanitize-html');

/**
 * Sanitize HTML content từ API bên ngoài (OPhim).
 * Chỉ cho phép các thẻ định dạng cơ bản, loại bỏ script/iframe/event handlers.
 */
function sanitizeContent(html) {
    if (!html) return '';
    return sanitizeHtml(html, {
        allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li'],
        allowedAttributes: {
            'a': ['href', 'title']
        },
        allowedSchemes: ['http', 'https'],
        disallowedTagsMode: 'discard'
    });
}

/**
 * Escape HTML đơn giản cho text thuần (không cho phép bất kỳ HTML nào).
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

module.exports = { sanitizeContent, escapeHtml };
