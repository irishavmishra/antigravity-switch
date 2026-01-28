// Tauri API wrapper for account management

import { invoke } from '@tauri-apps/api';
import type {
  Account,
  AccountsResponse,
  AccountResponse,
  SwitchResponse,
  ImportResponse,
  QuotaInfo,
} from '@/types';

// Get all accounts with quota
export async function getAccounts(): Promise<Account[]> {
  const response = await invoke<AccountsResponse>('get_accounts');
  if (response.success) {
    return response.accounts;
  }
  throw new Error('Failed to load accounts');
}

// Add a new account
export async function addAccount(
  email: string,
  refreshToken: string,
  name?: string
): Promise<Account> {
  const response = await invoke<AccountResponse>('add_account', {
    email,
    refreshToken,
    name,
  });
  if (response.success && response.account) {
    return response.account;
  }
  throw new Error('Failed to add account');
}

// Delete an account
export async function deleteAccount(accountId: string): Promise<void> {
  await invoke('delete_account', { accountId });
}

// Switch to an account
export async function switchAccount(accountId: string): Promise<string> {
  const response = await invoke<SwitchResponse>('switch_account', { accountId });
  if (response.success && response.email) {
    return response.email;
  }
  throw new Error(response.error || 'Failed to switch account');
}

// Get active account
export async function getActiveAccount(): Promise<Account | null> {
  const response = await invoke<AccountResponse>('get_active_account');
  if (response.success) {
    return response.account || null;
  }
  return null;
}

// Export accounts
export async function exportAccounts(): Promise<string> {
  return await invoke<string>('export_accounts');
}

// Import accounts
export async function importAccounts(jsonData: string): Promise<ImportResponse> {
  return await invoke<ImportResponse>('import_accounts', { jsonData });
}

// Get data directory
export async function getDataDir(): Promise<string> {
  return await invoke<string>('get_data_dir');
}

// Open URL
export async function openUrl(url: string): Promise<void> {
  await invoke('open_url', { url });
}

// Start OAuth flow
export async function startOAuthFlow(): Promise<string> {
  return await invoke<string>('start_oauth_flow');
}

// Handle OAuth callback
export async function handleOAuthCallback(code: string): Promise<Account> {
  const response = await invoke<AccountResponse>('handle_oauth_callback', { code });
  if (response.success && response.account) {
    return response.account;
  }
  throw new Error('OAuth failed');
}

// Refresh quota for account
export async function refreshQuota(accountId: string): Promise<QuotaInfo | null> {
  return await invoke<QuotaInfo | null>('refresh_quota', { accountId });
}
