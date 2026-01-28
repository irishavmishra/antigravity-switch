// Antigravity Multi-Account Manager
// ==================================

const API_BASE = 'http://localhost:3847/api';

let accountsData = [];
let isLoading = false;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    // Check for OAuth params
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const email = urlParams.get('email');

    if (success === 'account_added') {
        showNotification(`✅ Successfully added account for ${email}`, 'success');
        // Clean URL
        window.history.replaceState({}, document.title, "/");
    } else if (error) {
        showNotification(`❌ Error Adding Account: ${error}`, 'error');
        // Clean URL
        window.history.replaceState({}, document.title, "/");
    }

    loadAccounts();
});

// ==================== API CALLS ====================

async function fetchAccounts() {
    const response = await fetch(`${API_BASE}/accounts`);
    return await response.json();
}

async function addAccount(email, refreshToken) {
    const response = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, refreshToken })
    });
    return await response.json();
}

async function deleteAccount(accountId) {
    const response = await fetch(`${API_BASE}/accounts/${accountId}`, {
        method: 'DELETE'
    });
    return await response.json();
}

async function switchAccount(accountId) {
    const response = await fetch(`${API_BASE}/switch/${accountId}`, {
        method: 'POST'
    });
    return await response.json();
}

// ==================== UI RENDERING ====================

async function loadAccounts() {
    if (isLoading) return;
    isLoading = true;

    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.classList.add('spinning');

    try {
        const result = await fetchAccounts();

        if (result.success) {
            accountsData = result.accounts;
            renderAccounts(accountsData);
            updateStats(accountsData);
        } else {
            showNotification('Failed to load accounts: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Server error. Is the server running?', 'error');
        renderEmptyState();
    } finally {
        isLoading = false;
        refreshBtn.classList.remove('spinning');
    }
}

function updateStats(accounts) {
    document.getElementById('total-accounts').textContent = accounts.length;

    const active = accounts.find(a => a.isActive);
    document.getElementById('active-account').textContent = active ? active.email.split('@')[0] : 'None';

    const now = new Date();
    document.getElementById('last-updated').textContent = now.toLocaleTimeString();
}

function renderAccounts(accounts) {
    const grid = document.getElementById('accounts-grid');

    if (accounts.length === 0) {
        renderEmptyState();
        return;
    }

    grid.innerHTML = accounts.map(account => renderAccountCard(account)).join('');
}

function renderAccountCard(account) {
    const isActive = account.isActive;
    const hasError = account.quota?.error;

    let quotasHtml = '';
    if (hasError) {
        quotasHtml = `
            <div class="account-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                ${account.quota.error === 'forbidden' ? 'Account forbidden (403)' : 'Failed to load quota'}
            </div>
        `;
    } else if (account.quota?.models) {
        quotasHtml = `
            <div class="model-quotas">
                ${account.quota.models.map(model => {
            const percent = model.percentage;
            let statusClass = 'high';
            if (percent < 30) statusClass = 'low';
            else if (percent < 60) statusClass = 'medium';

            return `
                        <div class="model-quota">
                            <span class="model-name">${model.displayName}</span>
                            <div class="quota-bar-container">
                                <div class="quota-bar ${statusClass}" style="width: ${percent}%"></div>
                            </div>
                            <span class="quota-value ${statusClass}">${percent}%</span>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        // Add reset time if available
        const claudeQuota = account.quota.models.find(m => m.name === 'claude');
        if (claudeQuota?.resetTime) {
            const resetDate = new Date(claudeQuota.resetTime);
            quotasHtml += `
                <div class="reset-time">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Resets: ${resetDate.toLocaleString()}
                </div>
            `;
        }
    }

    // Calculate latest reset time from all models
    let maxResetTime = null;
    if (account.quota?.models) {
        account.quota.models.forEach(m => {
            if (m.resetTime) {
                const rt = new Date(m.resetTime);
                if (!maxResetTime || rt > maxResetTime) {
                    maxResetTime = rt;
                }
            }
        });
    }

    let renewalHtml = '';
    if (maxResetTime) {
        // Start countdown timer if not already running
        if (!window.countdownInterval) {
            startCountdownTimer();
        }

        const resetTimeStr = maxResetTime.toISOString();
        const dateStr = maxResetTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = maxResetTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + ' ' + /\((.*)\)/.exec(new Date().toString())[1]?.split(' ')[0] || 'GMT';

        // Add specific time zone offset display (e.g. GMT+5:30)
        const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const shortTz = new Date().toLocaleTimeString('en-us', { timeZoneName: 'short' }).split(' ')[2] || '';
        const offset = -new Date().getTimezoneOffset();
        const offsetHrs = Math.floor(Math.abs(offset) / 60);
        const offsetMins = Math.abs(offset) % 60;
        const offsetStr = `GMT${offset >= 0 ? '+' : '-'}${offsetHrs}${offsetMins > 0 ? ':' + offsetMins.toString().padStart(2, '0') : ''}`;

        renewalHtml = `
            <div class="renewal-section" data-reset-time="${resetTimeStr}">
                <div class="renewal-header">Renewal Schedule</div>
                
                <div class="countdown-container">
                    <div class="countdown-item">
                        <div class="countdown-value days">00</div>
                        <div class="countdown-label">Days</div>
                    </div>
                    <div class="countdown-separator">:</div>
                    <div class="countdown-item">
                        <div class="countdown-value hours">00</div>
                        <div class="countdown-label">Hours</div>
                    </div>
                    <div class="countdown-separator">:</div>
                    <div class="countdown-item">
                        <div class="countdown-value minutes">00</div>
                        <div class="countdown-label">Minutes</div>
                    </div>
                    <div class="countdown-separator">:</div>
                    <div class="countdown-item">
                        <div class="countdown-value seconds">00</div>
                        <div class="countdown-label">Seconds</div>
                    </div>
                </div>

                <div class="info-row">
                    <div class="info-label">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        Next Renewal
                    </div>
                    <div class="info-value">${dateStr}</div>
                </div>

                <div class="info-row">
                    <div class="info-label">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Renewal Time
                    </div>
                    <div class="info-value">${maxResetTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ${shortTz} (${offsetStr})</div>
                </div>

                <div class="info-row">
                    <div class="info-label">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        Plan Type
                    </div>
                    <div class="info-value"><span class="plan-badge">Antigravity Pro</span></div>
                </div>
            </div>
        `;
    }

    return `
        <div class="account-card ${isActive ? 'active' : ''}">
            <div class="account-header">
                <div class="account-info">
                    <div class="account-avatar">${account.name.charAt(0).toUpperCase()}</div>
                    <div class="account-details">
                        <h3>${account.name}</h3>
                        <p>${account.email}</p>
                    </div>
                </div>
                <div class="account-actions">
                    <button class="icon-btn delete" onclick="handleDelete('${account.id}', '${account.email}')" title="Delete account">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"/>
                        </svg>
                    </button>
                </div>
            </div>

            ${quotasHtml}

            ${renewalHtml}

            <button class="switch-btn ${isActive ? 'active' : ''}" 
                    onclick="handleSwitch('${account.id}')" 
                    ${isActive ? 'disabled' : ''}
                    id="switch-btn-${account.id}">
                ${isActive ? `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Currently Active
                ` : `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    Switch to This Account
                `}
            </button>
        </div>
    `;
}

function startCountdownTimer() {
    window.countdownInterval = setInterval(() => {
        const sections = document.querySelectorAll('.renewal-section');
        const now = new Date().getTime();

        sections.forEach(section => {
            const resetTimeStr = section.getAttribute('data-reset-time');
            if (!resetTimeStr) return;

            const target = new Date(resetTimeStr).getTime();
            const diff = target - now;

            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                section.querySelector('.days').textContent = days.toString().padStart(2, '0');
                section.querySelector('.hours').textContent = hours.toString().padStart(2, '0');
                section.querySelector('.minutes').textContent = minutes.toString().padStart(2, '0');
                section.querySelector('.seconds').textContent = seconds.toString().padStart(2, '0');
            } else {
                section.querySelector('.countdown-container').innerHTML = '<div class="countdown-value">Renewed</div>';
            }
        });
    }, 1000);
}

function renderEmptyState() {
    const grid = document.getElementById('accounts-grid');
    grid.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
            </div>
            <h3>No Accounts Yet</h3>
            <p>Add your first Antigravity account to start tracking quotas</p>
            <button class="btn btn-primary" onclick="showAddModal()">Add Account</button>
        </div>
    `;
}

// ==================== MODAL HANDLERS ====================

function showAddModal() {
    document.getElementById('add-modal').style.display = 'flex';
    document.getElementById('account-email').value = '';
    document.getElementById('account-token').value = '';
    document.getElementById('account-email').focus();
}

function hideAddModal() {
    document.getElementById('add-modal').style.display = 'none';
}

async function handleAddAccount(event) {
    event.preventDefault();

    const email = document.getElementById('account-email').value.trim();
    const refreshToken = document.getElementById('account-token').value.trim();

    if (!refreshToken) {
        showNotification('Refresh token is required', 'error');
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
        const result = await addAccount(email || null, refreshToken);

        if (result.success) {
            showNotification('Account added successfully!', 'success');
            hideAddModal();
            loadAccounts();
        } else {
            showNotification('Failed to add account: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Server error. Is the server running?', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Account';
    }
}

// ==================== ACTION HANDLERS ====================

async function handleDelete(accountId, email) {
    if (!confirm(`Delete account "${email}"?\n\nThis will only remove it from this manager, not from Antigravity.`)) {
        return;
    }

    try {
        const result = await deleteAccount(accountId);
        if (result.success) {
            showNotification('Account deleted', 'success');
            loadAccounts();
        } else {
            showNotification('Failed to delete: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Server error', 'error');
    }
}

async function handleSwitch(accountId) {
    const btn = document.getElementById(`switch-btn-${accountId}`);
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `
        <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
        Switching...
    `;

    try {
        const result = await switchAccount(accountId);

        if (result.success) {
            showNotification(`Switched to ${result.email}. Antigravity is restarting...`, 'success');
            setTimeout(() => loadAccounts(), 2000);
        } else {
            showNotification('Switch failed: ' + result.error, 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } catch (error) {
        showNotification('Server error. Is the server running?', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function exportAccounts() {
    window.location.href = `${API_BASE}/export`;
}

function importAccounts() {
    document.getElementById('import-file').click();
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = JSON.parse(e.target.result);

            if (!Array.isArray(content)) {
                showNotification('Invalid file format. Expected a list of accounts.', 'error');
                return;
            }

            // Confirm import
            if (!confirm(`Found ${content.length} accounts in file. Import them? Existing accounts will be updated.`)) {
                return;
            }

            const response = await fetch(`${API_BASE}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(content)
            });

            const result = await response.json();

            if (result.success) {
                showNotification(`Import successful! Added: ${result.added}, Updated: ${result.updated}`, 'success');
                loadAccounts();
            } else {
                showNotification('Import failed: ' + result.error, 'error');
            }

        } catch (error) {
            showNotification('Error parsing file: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

// ==================== NOTIFICATIONS ====================

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.style.display = 'none';
    }
    if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        loadAccounts();
    }
});
