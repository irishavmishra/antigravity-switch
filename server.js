/**
 * Antigravity Switch
 * Manage multiple accounts, view all quotas, one-click switch
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Load dependencies
let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    console.error('Failed to load better-sqlite3:', e);
}

// Server config
const PORT = 3847;
// Ensure we use a writable location for production
const DATA_DIR = path.join(os.homedir(), '.antigravity-manager');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const REQUEST_TIMEOUT = 30000;

// Google OAuth credentials
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;
const OAUTH_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/cloud-platform'
].join(' ');

// ==================== ACCOUNT STORAGE ====================

function loadAccounts() {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveAccounts(accounts) {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ==================== DATABASE PATHS ====================

function getDBPath() {
    const homedir = os.homedir();
    const platform = process.platform;

    if (platform === 'darwin') {
        return path.join(homedir, 'Library/Application Support/Antigravity/User/globalStorage/state.vscdb');
    } else if (platform === 'win32') {
        return path.join(homedir, 'AppData/Roaming/Antigravity/User/globalStorage/state.vscdb');
    } else {
        return path.join(homedir, '.config/Antigravity/User/globalStorage/state.vscdb');
    }
}

// ==================== TOKEN REFRESH ====================

function httpsPostForm(hostname, reqPath, formData) {
    return new Promise((resolve, reject) => {
        const postData = formData;
        const options = {
            hostname, port: 443, path: reqPath, method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'antigravity/1.11.3'
            },
            timeout: REQUEST_TIMEOUT
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, data }); }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(postData);
        req.end();
    });
}

function httpsPostJSON(hostname, reqPath, headers, body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        const options = {
            hostname, port: 443, path: reqPath, method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'antigravity/1.11.3'
            },
            timeout: REQUEST_TIMEOUT
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, data }); }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(postData);
        req.end();
    });
}

async function refreshAccessToken(refreshToken) {
    const postData = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
    }).toString();

    const result = await httpsPostForm('oauth2.googleapis.com', '/token', postData);

    if (result.status !== 200 || !result.data.access_token) {
        throw new Error(`Token refresh failed`);
    }

    return {
        accessToken: result.data.access_token,
        expiresIn: result.data.expires_in
    };
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code) {
    const postData = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
    }).toString();

    const result = await httpsPostForm('oauth2.googleapis.com', '/token', postData);

    if (result.status !== 200 || !result.data.access_token) {
        throw new Error(`Token exchange failed: ${JSON.stringify(result.data)}`);
    }

    return {
        accessToken: result.data.access_token,
        refreshToken: result.data.refresh_token,
        expiresIn: result.data.expires_in,
        idToken: result.data.id_token
    };
}

// Get user info from access token
async function getUserInfo(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.googleapis.com',
            port: 443,
            path: '/oauth2/v2/userinfo',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            timeout: REQUEST_TIMEOUT
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve({ email: 'unknown@example.com' });
                }
            });
        });

        req.on('error', () => resolve({ email: 'unknown@example.com' }));
        req.on('timeout', () => { req.destroy(); resolve({ email: 'unknown@example.com' }); });
        req.end();
    });
}

async function fetchProjectId(accessToken) {
    try {
        const result = await httpsPostJSON(
            'cloudcode-pa.googleapis.com',
            '/v1internal:loadCodeAssist',
            { 'Authorization': `Bearer ${accessToken}` },
            { metadata: { ideType: 'ANTIGRAVITY' } }
        );

        if (result.status === 200) {
            return result.data?.cloudaicompanionProject || result.data?.cloudaicompanion_project;
        }
    } catch (e) { }
    return 'bamboo-precept-lgxtn';
}

async function fetchQuota(accessToken, projectId) {
    const result = await httpsPostJSON(
        'cloudcode-pa.googleapis.com',
        '/v1internal:fetchAvailableModels',
        { 'Authorization': `Bearer ${accessToken}` },
        { project: projectId }
    );

    if (result.status === 403) {
        return { error: 'forbidden', models: [] };
    }

    const quotaMap = new Map();

    if (result.data?.models) {
        for (const [name, info] of Object.entries(result.data.models)) {
            const q = info.quotaInfo;
            if (!q) continue;

            const nameLower = name.toLowerCase();
            let modelId = name;
            let displayName = name;
            let priority = 100;

            // Normalize and categorize known models
            if (nameLower.includes('claude') && nameLower.includes('sonnet') && !nameLower.includes('thinking')) {
                modelId = 'claude-sonnet';
                displayName = 'Claude Sonnet';
                priority = 1;
            } else if (nameLower.includes('gemini') && nameLower.includes('pro')) {
                modelId = 'gemini-pro';
                displayName = 'Gemini Pro';
                priority = 2;
            } else if (nameLower.includes('gemini') && nameLower.includes('flash')) {
                modelId = 'gemini-flash';
                displayName = 'Gemini Flash';
                priority = 3;
            } else if (nameLower.includes('thinking')) {
                modelId = 'claude-thinking';
                displayName = '4.5 Thinking';
                priority = 4;
            } else {
                // Fallback for others: clean up the name

                // 1. Remove prefixes like "models/"
                let cleanName = name.split('/').pop();

                // 2. Specialized handling for vague "Chat_XXXX"
                if (cleanName.match(/^Chat_\d+$/i)) {
                    displayName = `Experimental ${cleanName.replace('_', ' ')}`;
                    priority = 90; // Low priority
                } else {
                    // 3. General cleanup
                    // Replace underscores and dashes with spaces
                    displayName = cleanName.replace(/[-_]/g, ' ');

                    // 4. Smart Title Casing & Acronyms
                    displayName = displayName.replace(/\b\w+/g, word => {
                        // Known acronyms to uppercase
                        if (['gpt', 'oss', 'api', 'llm'].includes(word.toLowerCase())) {
                            return word.toUpperCase();
                        }
                        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                    });
                }
            }

            const fraction = q.remainingFraction ?? 0;

            // Deduplicate by modelId (groups variants together)
            if (quotaMap.has(modelId)) {
                const existing = quotaMap.get(modelId);
                // Keep the conservative (lowest) quota
                if (fraction < existing.rawFraction) {
                    quotaMap.set(modelId, {
                        ...existing,
                        percentage: Math.round(fraction * 100),
                        rawFraction: fraction,
                        resetTime: q.resetTime || existing.resetTime
                    });
                }
            } else {
                quotaMap.set(modelId, {
                    name: modelId,
                    displayName: displayName,
                    percentage: Math.round(fraction * 100),
                    rawFraction: fraction,
                    resetTime: q.resetTime || null,
                    priority: priority
                });
            }
        }
    }

    // Sort by priority, then name
    const quotas = Array.from(quotaMap.values()).sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.displayName.localeCompare(b.displayName);
    });

    return { models: quotas };
}

// ==================== FETCH ALL ACCOUNTS QUOTA ====================

async function fetchAllAccountsQuota() {
    const accounts = loadAccounts();
    const results = [];

    for (const account of accounts) {
        try {
            // Refresh token
            const tokenData = await refreshAccessToken(account.refreshToken);

            // Get project ID
            const projectId = await fetchProjectId(tokenData.accessToken);

            // Get quota
            const quota = await fetchQuota(tokenData.accessToken, projectId);

            // Update account with latest access token
            account.accessToken = tokenData.accessToken;
            account.expiresAt = Date.now() + (tokenData.expiresIn * 1000);
            account.lastChecked = Date.now();

            results.push({
                id: account.id,
                email: account.email,
                name: account.name || account.email.split('@')[0],
                quota: quota.error ? { error: quota.error } : quota,
                isActive: account.isActive || false,
                lastChecked: account.lastChecked
            });
        } catch (error) {
            results.push({
                id: account.id,
                email: account.email,
                name: account.name || account.email.split('@')[0],
                quota: { error: error.message },
                isActive: account.isActive || false,
                lastChecked: null
            });
        }
    }

    saveAccounts(accounts);
    return results;
}

// ==================== ACCOUNT SWITCHING ====================

// Protobuf encoding helpers
function encodeVarint(value) {
    const bytes = [];
    let v = value >>> 0;
    while (v >= 0x80) {
        bytes.push((v & 0x7F) | 0x80);
        v = v >>> 7;
    }
    bytes.push(v);
    return bytes;
}

function createOAuthField(accessToken, refreshToken, expiry) {
    const parts = [];
    const addString = (field, str) => {
        parts.push(...encodeVarint((field << 3) | 2));
        const buf = Buffer.from(str, 'utf-8');
        parts.push(...encodeVarint(buf.length));
        for (const b of buf) parts.push(b);
    };

    addString(1, accessToken);
    addString(2, 'Bearer');
    addString(3, refreshToken);

    // Field 4: expiry
    const timestampParts = [];
    timestampParts.push(...encodeVarint((1 << 3) | 0));
    timestampParts.push(...encodeVarint(expiry));
    parts.push(...encodeVarint((4 << 3) | 2));
    parts.push(...encodeVarint(timestampParts.length));
    parts.push(...timestampParts);

    const tag6 = (6 << 3) | 2;
    const field6 = [];
    field6.push(...encodeVarint(tag6));
    field6.push(...encodeVarint(parts.length));
    field6.push(...parts);

    return Buffer.from(field6);
}

function readVarint(data, offset) {
    let result = 0, shift = 0, pos = offset;
    while (pos < data.length) {
        const byte = data[pos++];
        result |= (byte & 0x7F) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
    }
    return { value: result >>> 0, newOffset: pos };
}

function skipField(data, offset, wireType) {
    if (wireType === 0) return readVarint(data, offset).newOffset;
    if (wireType === 1) return offset + 8;
    if (wireType === 2) {
        const len = readVarint(data, offset);
        return len.newOffset + len.value;
    }
    if (wireType === 5) return offset + 4;
    throw new Error('Unknown wire type');
}

function removeField(data, fieldNum) {
    const result = [];
    let offset = 0;
    while (offset < data.length) {
        const startOffset = offset;
        const tag = readVarint(data, offset);
        const wireType = tag.value & 7;
        const currentField = tag.value >> 3;
        const nextOffset = skipField(data, tag.newOffset, wireType);
        if (currentField !== fieldNum) {
            for (let i = startOffset; i < nextOffset; i++) result.push(data[i]);
        }
        offset = nextOffset;
    }
    return Buffer.from(result);
}

// Kill Antigravity processes (Async to prevent blocking)
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function killAntigravity() {
    const platform = os.platform();
    try {
        if (platform === 'darwin') {
            await execAsync('pkill -9 -i "Antigravity" 2>/dev/null || true');
            await execAsync('pkill -9 -f "Antigravity Helper" 2>/dev/null || true');
        } else if (platform === 'win32') {
            await execAsync('taskkill /F /IM Antigravity.exe /T 2>nul || exit 0');
        }
        return true;
    } catch (e) {
        // Ignore errors if process wasn't running
        return false;
    }
}

// Clean lock files
function cleanLockFiles(dbPath) {
    ['.vscdb-wal', '.vscdb-shm'].forEach(suffix => {
        const p = dbPath.replace('.vscdb', suffix);
        if (fs.existsSync(p)) {
            try { fs.unlinkSync(p); } catch (e) { }
        }
    });
}


// Inject token into Antigravity database
async function injectTokenIntoDB(accessToken, refreshToken, expiry, email) {
    const dbPath = getDBPath();
    if (!fs.existsSync(dbPath)) {
        throw new Error('Antigravity database not found. Is Antigravity installed?');
    }

    // Make writable
    try {
        fs.chmodSync(dbPath, 0o644);
        ['.vscdb-wal', '.vscdb-shm', '.vscdb.backup'].forEach(suffix => {
            const p = dbPath.replace('.vscdb', suffix);
            if (fs.existsSync(p)) fs.chmodSync(p, 0o644);
        });
    } catch (e) { }

    return new Promise((resolve, reject) => {
        try {
            const db = new Database(dbPath, { timeout: 5000 });

            // Check WAL mode to prevent locking issues
            db.pragma('journal_mode = WAL');

            // Wrap in transaction for safety
            const updateTransaction = db.transaction(() => {
                const jetskiKey = 'jetskiStateSync.agentManagerInitState';

                // 1. Get current value
                const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(jetskiKey);
                const currentValue = row ? row.value : null;

                if (currentValue) {
                    try {
                        const blob = Buffer.from(currentValue, 'base64');
                        const cleanData = removeField(blob, 6);
                        const newField = createOAuthField(accessToken, refreshToken, expiry);
                        const finalData = Buffer.concat([cleanData, newField]);
                        const newValue = finalData.toString('base64');

                        db.prepare("UPDATE ItemTable SET value = ? WHERE key = ?").run(newValue, jetskiKey);
                    } catch (e) {
                        console.error('Error processing token data:', e);
                    }
                }

                // 2. Update auth status
                if (email) {
                    const authKey = 'antigravityAuthStatus';
                    const newAuth = JSON.stringify({
                        email: email,
                        apiKey: accessToken,
                        name: email.split('@')[0]
                    });

                    db.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)").run(authKey, newAuth);
                }

                // 3. Clear cache keys
                const keysToDelete = [
                    'google.geminicodeassist',
                    'google.geminicodeassist.hasRunOnce',
                    'geminiCodeAssist.chatThreads'
                ];

                const stmt = db.prepare("DELETE FROM ItemTable WHERE key = ? OR key LIKE ?");
                keysToDelete.forEach(k => {
                    stmt.run(k, `${k}.%`);
                });
            });

            // Execute transaction
            updateTransaction();

            db.close();
            resolve(true);

        } catch (err) {
            console.error('Database error:', err);
            reject(err);
        }
    });
}

// Switch to account
async function switchToAccount(accountId) {
    const accounts = loadAccounts();
    const account = accounts.find(a => a.id === accountId);

    if (!account) {
        throw new Error('Account not found');
    }

    // Refresh token if needed
    let accessToken = account.accessToken;
    if (!accessToken || Date.now() > (account.expiresAt - 300000)) {
        const tokenData = await refreshAccessToken(account.refreshToken);
        accessToken = tokenData.accessToken;
        account.accessToken = accessToken;
        account.expiresAt = Date.now() + (tokenData.expiresIn * 1000);
    }

    // Kill Antigravity
    await killAntigravity();
    await new Promise(r => setTimeout(r, 1000));

    // Clean lock files
    cleanLockFiles(getDBPath());
    await new Promise(r => setTimeout(r, 200));

    // Inject token
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    await injectTokenIntoDB(accessToken, account.refreshToken, expiry, account.email);

    // Mark as active
    accounts.forEach(a => a.isActive = false);
    account.isActive = true;
    account.lastSwitched = Date.now();
    saveAccounts(accounts);

    // Restart Antigravity
    if (os.platform() === 'darwin') {
        spawn('open', ['-a', 'Antigravity'], { detached: true, stdio: 'ignore' }).unref();
    } else if (os.platform() === 'win32') {
        const exePath = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Antigravity', 'Antigravity.exe');
        if (fs.existsSync(exePath)) {
            spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
        } else {
            console.error('Could not find Antigravity.exe at', exePath);
        }
    }

    return { success: true, email: account.email };
}

// ==================== HTTP SERVER ====================

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // ==================== OAUTH ENDPOINTS ====================

    // Start OAuth flow - redirects to Google login
    if (url.pathname === '/auth/google') {
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', OAUTH_SCOPES);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token

        res.writeHead(302, { 'Location': authUrl.toString() });
        res.end();
        return;
    }

    // OAuth callback - receives code, exchanges for tokens, adds account
    if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
            res.writeHead(302, { 'Location': '/?error=' + encodeURIComponent(error) });
            res.end();
            return;
        }

        if (!code) {
            res.writeHead(302, { 'Location': '/?error=no_code' });
            res.end();
            return;
        }

        try {
            console.log('🔐 OAuth callback received, exchanging code for tokens...');

            // Exchange code for tokens
            const tokens = await exchangeCodeForTokens(code);
            console.log('✓ Tokens received');

            // Get user info
            const userInfo = await getUserInfo(tokens.accessToken);
            console.log(`✓ User: ${userInfo.email}`);

            // Check if account already exists
            const accounts = loadAccounts();
            const existingAccount = accounts.find(a => a.email === userInfo.email);

            if (existingAccount) {
                // Update existing account tokens
                existingAccount.refreshToken = tokens.refreshToken;
                existingAccount.accessToken = tokens.accessToken;
                existingAccount.expiresAt = Date.now() + (tokens.expiresIn * 1000);
                saveAccounts(accounts);
                console.log(`✓ Updated existing account: ${userInfo.email}`);
            } else {
                // Add new account
                const newAccount = {
                    id: generateId(),
                    email: userInfo.email,
                    name: userInfo.name || userInfo.email.split('@')[0],
                    picture: userInfo.picture,
                    refreshToken: tokens.refreshToken,
                    accessToken: tokens.accessToken,
                    expiresAt: Date.now() + (tokens.expiresIn * 1000),
                    isActive: accounts.length === 0,
                    addedAt: Date.now()
                };
                accounts.push(newAccount);
                saveAccounts(accounts);
                console.log(`✓ Added new account: ${userInfo.email}`);
            }

            // Redirect to dashboard with success
            res.writeHead(302, { 'Location': '/?success=account_added&email=' + encodeURIComponent(userInfo.email) });
            res.end();
        } catch (err) {
            console.error('❌ OAuth error:', err.message);
            res.writeHead(302, { 'Location': '/?error=' + encodeURIComponent(err.message) });
            res.end();
        }
        return;
    }

    // ==================== API ENDPOINTS ====================

    // API: Get all accounts with quota
    if (url.pathname === '/api/accounts' && req.method === 'GET') {
        try {
            const accounts = await fetchAllAccountsQuota();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, accounts }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // API: Add new account
    if (url.pathname === '/api/accounts' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { refreshToken, email, name } = data;

                if (!refreshToken) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Refresh token required' }));
                    return;
                }

                // Validate token by refreshing
                const tokenData = await refreshAccessToken(refreshToken);

                // Get user info if email not provided
                let userEmail = email;
                if (!userEmail) {
                    // Try to get from token or use placeholder
                    userEmail = 'unknown@example.com';
                }

                const accounts = loadAccounts();
                const newAccount = {
                    id: generateId(),
                    email: userEmail,
                    name: name || userEmail.split('@')[0],
                    refreshToken: refreshToken,
                    accessToken: tokenData.accessToken,
                    expiresAt: Date.now() + (tokenData.expiresIn * 1000),
                    isActive: accounts.length === 0, // First account is active
                    addedAt: Date.now()
                };

                accounts.push(newAccount);
                saveAccounts(accounts);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, account: { id: newAccount.id, email: newAccount.email } }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // API: Delete account
    if (url.pathname.match(/^\/api\/accounts\/[^/]+$/) && req.method === 'DELETE') {
        const accountId = url.pathname.split('/').pop();
        const accounts = loadAccounts();
        const filtered = accounts.filter(a => a.id !== accountId);

        if (filtered.length === accounts.length) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Account not found' }));
            return;
        }

        saveAccounts(filtered);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // API: Switch to account
    if (url.pathname.match(/^\/api\/switch\/[^/]+$/) && req.method === 'POST') {
        const accountId = url.pathname.split('/').pop();
        try {
            const result = await switchToAccount(accountId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // API: Get current active account
    if (url.pathname === '/api/active' && req.method === 'GET') {
        const accounts = loadAccounts();
        const active = accounts.find(a => a.isActive);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, account: active || null }));
        return;
    }

    // API: Export accounts
    if (url.pathname === '/api/export' && req.method === 'GET') {
        try {
            const accounts = loadAccounts();
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="antigravity-accounts.json"'
            });
            res.end(JSON.stringify(accounts, null, 2));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // API: Import accounts
    if (url.pathname === '/api/import' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const importedAccounts = JSON.parse(body);
                if (!Array.isArray(importedAccounts)) {
                    throw new Error('Invalid format: structure must be an array');
                }

                const currentAccounts = loadAccounts();
                let addedCount = 0;
                let updatedCount = 0;

                importedAccounts.forEach(imported => {
                    if (!imported.email || !imported.refreshToken) return;

                    const existingIndex = currentAccounts.findIndex(a => a.email === imported.email);
                    if (existingIndex >= 0) {
                        // Update existing
                        currentAccounts[existingIndex] = { ...currentAccounts[existingIndex], ...imported };
                        updatedCount++;
                    } else {
                        // Add new
                        // Ensure ID uniqueness
                        if (!imported.id || currentAccounts.some(a => a.id === imported.id)) {
                            imported.id = generateId();
                        }
                        currentAccounts.push(imported);
                        addedCount++;
                    }
                });

                saveAccounts(currentAccounts);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, added: addedCount, updated: updatedCount }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    filePath = path.join(__dirname, filePath);

    const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json'
    };

    if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(content);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🚀 Antigravity Multi-Account Manager                            ║
║                                                                  ║
║   Open: http://localhost:${PORT}                                   ║
║                                                                  ║
║   Features:                                                       ║
║   • View quota for ALL accounts                                   ║
║   • Add accounts with refresh token                              ║
║   • One-click switch (no logout needed!)                         ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
});
