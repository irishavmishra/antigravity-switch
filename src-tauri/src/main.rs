// Antigravity Switch - Tauri Backend
// Main entry point with all account management commands

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{CustomMenuItem, Manager, State, SystemTray, SystemTrayEvent, SystemTrayMenu};

mod account;
mod db;
mod oauth;
mod quota;
mod switch;

use account::{Account, AccountManager};
use quota::QuotaInfo;

// Application state
pub struct AppState {
    account_manager: Mutex<AccountManager>,
}

// Error types
#[derive(Debug, Serialize)]
struct ApiError {
    error: String,
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError {
            error: err.to_string(),
        }
    }
}

impl From<std::io::Error> for ApiError {
    fn from(err: std::io::Error) -> Self {
        ApiError {
            error: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError {
            error: err.to_string(),
        }
    }
}

// API Response types
#[derive(Serialize)]
struct AccountsResponse {
    success: bool,
    accounts: Vec<AccountWithQuota>,
}

#[derive(Serialize)]
struct AccountResponse {
    success: bool,
    account: Option<Account>,
}

#[derive(Serialize)]
struct SwitchResponse {
    success: bool,
    email: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
struct ImportResponse {
    success: bool,
    added: usize,
    updated: usize,
}

#[derive(Serialize, Deserialize, Clone)]
struct AccountWithQuota {
    id: String,
    email: String,
    name: String,
    picture: Option<String>,
    quota: Option<QuotaInfo>,
    is_active: bool,
    last_checked: Option<i64>,
}

// ==================== COMMANDS ====================

/// Get all accounts with their quota information
#[tauri::command]
async fn get_accounts(state: State<'_, AppState>) -> Result<AccountsResponse, ApiError> {
    // Load accounts first, then release the lock before await
    let accounts = {
        let manager = state.account_manager.lock().unwrap();
        manager.load_accounts()?
    };
    
    let mut accounts_with_quota = Vec::new();
    
    for account in accounts {
        // Try to fetch quota for each account
        let quota = if account.access_token.is_some() {
            match quota::fetch_quota(&account).await {
                Ok(q) => Some(q),
                Err(_) => None,
            }
        } else {
            None
        };
        
        accounts_with_quota.push(AccountWithQuota {
            id: account.id.clone(),
            email: account.email.clone(),
            name: account.name.clone().unwrap_or_else(|| account.email.split('@').next().unwrap_or("Unknown").to_string()),
            picture: account.picture.clone(),
            quota,
            is_active: account.is_active,
            last_checked: account.last_checked,
        });
    }
    
    Ok(AccountsResponse {
        success: true,
        accounts: accounts_with_quota,
    })
}

/// Add a new account
#[tauri::command]
async fn add_account(
    email: String,
    refresh_token: String,
    name: Option<String>,
    state: State<'_, AppState>,
) -> Result<AccountResponse, ApiError> {
    // Validate the token by trying to refresh it first (before acquiring lock)
    let token_data = match oauth::refresh_access_token(&refresh_token).await {
        Ok(token_data) => token_data,
        Err(_) => {
            return Ok(AccountResponse {
                success: false,
                account: None,
            });
        }
    };
    
    let mut manager = state.account_manager.lock().unwrap();
    let account = manager.add_account(email, refresh_token, name, Some(token_data))?;
    
    Ok(AccountResponse {
        success: true,
        account: Some(account),
    })
}

/// Delete an account
#[tauri::command]
async fn delete_account(account_id: String, state: State<'_, AppState>) -> Result<bool, ApiError> {
    let mut manager = state.account_manager.lock().unwrap();
    manager.delete_account(&account_id)?;
    Ok(true)
}

/// Switch to an account - FIXED VERSION
#[tauri::command]
async fn switch_account(
    account_id: String,
    state: State<'_, AppState>,
    _app_handle: tauri::AppHandle,
) -> Result<SwitchResponse, ApiError> {
    // Get the account first, then release the lock
    let account = {
        let manager = state.account_manager.lock().unwrap();
        match manager.get_account(&account_id) {
            Some(acc) => acc,
            None => {
                return Ok(SwitchResponse {
                    success: false,
                    email: None,
                    error: Some("Account not found".to_string()),
                });
            }
        }
    };
    
    // Refresh token if needed (outside the lock)
    let access_token = if account.access_token.is_none() ||
        account.expires_at.map(|exp| chrono::Utc::now().timestamp_millis() > exp - 300000).unwrap_or(true) {
        match oauth::refresh_access_token(&account.refresh_token).await {
            Ok(token_data) => {
                // Re-acquire lock to update token
                let mut manager = state.account_manager.lock().unwrap();
                manager.update_account_token(&account_id, &token_data.access_token, token_data.expires_in)?;
                token_data.access_token
            }
            Err(_e) => {
                return Ok(SwitchResponse {
                    success: false,
                    email: None,
                    error: Some("Token refresh failed".to_string()),
                });
            }
        }
    } else {
        account.access_token.unwrap_or_default()
    };
    
    // Kill Antigravity processes
    if let Err(e) = switch::kill_antigravity().await {
        eprintln!("Warning: Failed to kill Antigravity: {}", e);
    }
    
    // Small delay to ensure processes are terminated
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Clean lock files
    switch::clean_lock_files();
    
    // Inject token into database - FIXED with better error handling
    let expiry = chrono::Utc::now().timestamp() + 3600;
    match switch::inject_token_into_db(&access_token, &account.refresh_token, expiry, &account.email).await {
        Ok(_) => {
            // Mark account as active
            let mut manager = state.account_manager.lock().unwrap();
            manager.set_active_account(&account_id)?;
            drop(manager); // Release lock before restart
            
            // Restart Antigravity
            if let Err(e) = switch::restart_antigravity().await {
                eprintln!("Warning: Failed to restart Antigravity: {}", e);
            }
            
            Ok(SwitchResponse {
                success: true,
                email: Some(account.email.clone()),
                error: None,
            })
        }
        Err(_e) => {
            // Try to restart Antigravity anyway - the token might still work on next launch
            let _ = switch::restart_antigravity().await;
            
            Ok(SwitchResponse {
                success: false,
                email: None,
                error: Some("Database injection failed".to_string()),
            })
        }
    }
}

/// Get the currently active account
#[tauri::command]
async fn get_active_account(state: State<'_, AppState>) -> Result<AccountResponse, ApiError> {
    let manager = state.account_manager.lock().unwrap();
    let active = manager.get_active_account()?;
    Ok(AccountResponse {
        success: true,
        account: active,
    })
}

/// Export accounts to JSON
#[tauri::command]
async fn export_accounts(state: State<'_, AppState>) -> Result<String, ApiError> {
    let manager = state.account_manager.lock().unwrap();
    let accounts = manager.load_accounts()?;
    let json = serde_json::to_string_pretty(&accounts)?;
    Ok(json)
}

/// Import accounts from JSON
#[tauri::command]
async fn import_accounts(
    json_data: String,
    state: State<'_, AppState>,
) -> Result<ImportResponse, ApiError> {
    let imported: Vec<Account> = serde_json::from_str(&json_data)?;
    let mut manager = state.account_manager.lock().unwrap();
    
    let (added, updated) = manager.import_accounts(imported)?;
    
    Ok(ImportResponse {
        success: true,
        added,
        updated,
    })
}

/// Get app data directory path
#[tauri::command]
fn get_data_dir() -> Result<String, ApiError> {
    let path = account::get_data_dir()?;
    Ok(path.to_string_lossy().to_string())
}

/// Open external URL
#[tauri::command]
fn open_url(url: String) -> Result<(), ApiError> {
    open::that(url)?;
    Ok(())
}

/// Start OAuth flow
#[tauri::command]
async fn start_oauth_flow() -> Result<String, ApiError> {
    let auth_url = oauth::get_auth_url()?;
    Ok(auth_url)
}

/// Handle OAuth callback
#[tauri::command]
async fn handle_oauth_callback(
    code: String,
    state: State<'_, AppState>,
) -> Result<AccountResponse, ApiError> {
    // Exchange code for tokens
    let tokens = match oauth::exchange_code_for_tokens(&code).await {
        Ok(t) => t,
        Err(_e) => {
            return Ok(AccountResponse {
                success: false,
                account: None,
            });
        }
    };
    
    // Get user info
    let user_info = match oauth::get_user_info(&tokens.access_token).await {
        Ok(u) => u,
        Err(_e) => {
            return Ok(AccountResponse {
                success: false,
                account: None,
            });
        }
    };
    
    // Add or update account
    let mut manager = state.account_manager.lock().unwrap();
    let account = manager.add_or_update_oauth_account(user_info, tokens)?;
    
    Ok(AccountResponse {
        success: true,
        account: Some(account),
    })
}

/// Refresh quota for a specific account
#[tauri::command]
async fn refresh_quota(
    account_id: String,
    state: State<'_, AppState>,
) -> Result<Option<QuotaInfo>, ApiError> {
    // Get account first, then release the lock before await
    let account = {
        let manager = state.account_manager.lock().unwrap();
        manager.get_account(&account_id)
    };
    
    if let Some(acc) = account {
        match quota::fetch_quota(&acc).await {
            Ok(quota) => Ok(Some(quota)),
            Err(_) => Ok(None),
        }
    } else {
        Ok(None)
    }
}

// ==================== MAIN ====================

fn main() {
    // Initialize account manager
    let account_manager = match AccountManager::new() {
        Ok(am) => Mutex::new(am),
        Err(e) => {
            eprintln!("Failed to initialize account manager: {}", e);
            std::process::exit(1);
        }
    };

    let app_state = AppState { account_manager };

    // Create system tray menu
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show"))
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .manage(app_state)
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                window.set_focus().unwrap();
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            add_account,
            delete_account,
            switch_account,
            get_active_account,
            export_accounts,
            import_accounts,
            get_data_dir,
            open_url,
            start_oauth_flow,
            handle_oauth_callback,
            refresh_quota,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
