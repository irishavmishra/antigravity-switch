// Type definitions for Antigravity Switch

export interface Account {
  id: string;
  email: string;
  name: string;
  picture?: string;
  quota?: QuotaInfo;
  is_active: boolean;
  last_checked?: number;
  refresh_token?: string;
}

export interface QuotaInfo {
  models: ModelQuota[];
  error?: string;
}

export interface ModelQuota {
  name: string;
  display_name: string;
  percentage: number;
  reset_time?: string;
  badge?: Badge;
}

export interface Badge {
  text: string;
  color: string;
  badge_type: string;
}

export interface AccountsResponse {
  success: boolean;
  accounts: Account[];
}

export interface AccountResponse {
  success: boolean;
  account?: Account;
}

export interface SwitchResponse {
  success: boolean;
  email?: string;
  error?: string;
}

export interface ImportResponse {
  success: boolean;
  added: number;
  updated: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type ViewMode = 'accounts' | 'settings' | 'about';
