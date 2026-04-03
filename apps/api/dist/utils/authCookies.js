import env from '../config/env.js';
const REFRESH_COOKIE_NAME = env.REFRESH_COOKIE_NAME;
const parseCookies = (cookieHeader) => {
    if (!cookieHeader) {
        return {};
    }
    return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((cookies, part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
            return cookies;
        }
        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (key) {
            cookies[key] = decodeURIComponent(value);
        }
        return cookies;
    }, {});
};
export const getRefreshTokenFromRequest = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[REFRESH_COOKIE_NAME] ?? null;
};
export const setRefreshTokenCookie = (res, refreshToken) => {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        sameSite: env.COOKIE_SAME_SITE,
        secure: env.COOKIE_SECURE,
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};
export const clearRefreshTokenCookie = (res) => {
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        sameSite: env.COOKIE_SAME_SITE,
        secure: env.COOKIE_SECURE,
        path: '/api/v1/auth',
    });
};
export const setNoStoreHeaders = (res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
};
