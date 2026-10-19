const crypto = require("crypto");

const sessions = new Map();

function createSession() {
    const sessionId = crypto.randomBytes(4).toString("hex");

    const session = {
        id: sessionId,
        laptop: null,
        phone: null,
        createdAt: Date.now()
    };

    sessions.set(sessionId, session);

    return session;
}

function getSession(sessionId) {
    return sessions.get(sessionId);
}

function deleteSession(sessionId) {
    sessions.delete(sessionId);
}

module.exports = {
    createSession,
    getSession,
    deleteSession
};