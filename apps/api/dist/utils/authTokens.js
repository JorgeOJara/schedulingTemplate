import jwt from 'jsonwebtoken';
import env from '../config/env.js';
const JWT_SECRET = env.JWT_SECRET;
export const TOKEN_TYPES = {
    ACCESS: 'access',
    REFRESH: 'refresh',
    INVITE: 'invite',
    PASSWORD_RESET: 'password_reset',
};
const signToken = (payload, expiresIn) => {
    const options = { expiresIn: expiresIn };
    return jwt.sign(payload, JWT_SECRET, options);
};
const verifyTypedToken = (token, expectedTokenType) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || typeof decoded !== 'object') {
            return null;
        }
        const payload = decoded;
        return payload.tokenType === expectedTokenType ? payload : null;
    }
    catch {
        return null;
    }
};
export const signAccessToken = (userId, orgId, role) => {
    return signToken({
        tokenType: TOKEN_TYPES.ACCESS,
        userId,
        orgId,
        role,
    }, env.JWT_EXPIRY);
};
export const signRefreshToken = (userId) => {
    return signToken({
        tokenType: TOKEN_TYPES.REFRESH,
        userId,
    }, env.REFRESH_TOKEN_EXPIRY);
};
export const signInviteToken = (payload) => {
    return signToken({
        tokenType: TOKEN_TYPES.INVITE,
        ...payload,
    }, '7d');
};
export const signPasswordResetToken = (userId) => {
    return signToken({
        tokenType: TOKEN_TYPES.PASSWORD_RESET,
        userId,
    }, '1h');
};
export const verifyAccessToken = (token) => {
    return verifyTypedToken(token, TOKEN_TYPES.ACCESS);
};
export const verifyRefreshToken = (token) => {
    return verifyTypedToken(token, TOKEN_TYPES.REFRESH);
};
export const verifyInviteToken = (token) => {
    return verifyTypedToken(token, TOKEN_TYPES.INVITE);
};
export const verifyPasswordResetToken = (token) => {
    return verifyTypedToken(token, TOKEN_TYPES.PASSWORD_RESET);
};
