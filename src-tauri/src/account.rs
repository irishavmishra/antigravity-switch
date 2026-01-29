// Account management - storage and CRUD operations

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::oauth::{TokenData, UserInfo};

/// Account structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub refresh_token: String,
    pub access_token: Option<String>,
    pub expires_at: Option<i64>,
    pub is_active: bool,
    pub added_at: i64,
    pub last_switched: Option<i64>,
    pub last_checked: Option<i64>,
}

/// Account manager handles all account operations
pub struct AccountManager {
    #[allow(dead_code)]
    data_dir: PathBuf,
    accounts_file: PathBuf,
}

impl AccountManager {
    /// Create a new account manager
    pub fn new() -> anyhow::Result<Self> {
        let data_dir = get_data_dir()?;
        fs::create_dir_all(&data_dir)?;
        
        let accounts_file = data_dir.join("accounts.json");
        
        Ok(AccountManager {
            data_dir,
            accounts_file,
        })
    }
    
    /// Load all accounts from storage
    pub fn load_accounts(&self) -> anyhow::Result<Vec<Account>> {
        if !self.accounts_file.exists() {
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(&self.accounts_file)?;
        let accounts: Vec<Account> = serde_json::from_str(&content)?;
        Ok(accounts)
    }
    
    /// Save accounts to storage
    fn save_accounts(&self, accounts: &[Account]) -> anyhow::Result<()> {
        let content = serde_json::to_string_pretty(accounts)?;
        let mut file = fs::File::create(&self.accounts_file)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?; // Force flush to disk
        Ok(())
    }
    
    /// Add a new account
    pub fn add_account(
        &mut self,
        email: String,
        refresh_token: String,
        name: Option<String>,
        token_data: Option<TokenData>,
    ) -> anyhow::Result<Account> {
        let mut accounts = self.load_accounts()?;
        
        // Check if account already exists
        if accounts.iter().any(|a| a.email == email) {
            anyhow::bail!("Account already exists");
        }
        
        let account = Account {
            id: Uuid::new_v4().to_string(),
            email: email.clone(),
            name: name.or_else(|| Some(email.split('@').next().unwrap_or("Unknown").to_string())),
            picture: None,
            refresh_token,
            access_token: token_data.as_ref().map(|t| t.access_token.clone()),
            expires_at: token_data.map(|t| chrono::Utc::now().timestamp_millis() + (t.expires_in * 1000)),
            is_active: accounts.is_empty(), // First account is active
            added_at: chrono::Utc::now().timestamp_millis(),
            last_switched: None,
            last_checked: None,
        };
        
        accounts.push(account.clone());
        self.save_accounts(&accounts)?;
        
        Ok(account)
    }
    
    /// Delete an account
    pub fn delete_account(&mut self, account_id: &str) -> anyhow::Result<()> {
        let mut accounts = self.load_accounts()?;
        let initial_len = accounts.len();
        
        accounts.retain(|a| a.id != account_id);
        
        if accounts.len() == initial_len {
            anyhow::bail!("Account not found");
        }
        
        self.save_accounts(&accounts)?;
        Ok(())
    }
    
    /// Get a specific account
    pub fn get_account(&self, account_id: &str) -> Option<Account> {
        let accounts = self.load_accounts().ok()?;
        accounts.into_iter().find(|a| a.id == account_id)
    }
    
    /// Get the active account
    pub fn get_active_account(&self) -> anyhow::Result<Option<Account>> {
        let accounts = self.load_accounts()?;
        Ok(accounts.into_iter().find(|a| a.is_active))
    }
    
    /// Set an account as active
    pub fn set_active_account(&mut self, account_id: &str) -> anyhow::Result<()> {
        let mut accounts = self.load_accounts()?;
        
        let mut found = false;
        for account in &mut accounts {
            if account.id == account_id {
                account.is_active = true;
                account.last_switched = Some(chrono::Utc::now().timestamp_millis());
                found = true;
            } else {
                account.is_active = false;
            }
        }
        
        if !found {
            anyhow::bail!("Account not found");
        }
        
        self.save_accounts(&accounts)?;
        Ok(())
    }
    
    /// Update account token
    pub fn update_account_token(
        &mut self,
        account_id: &str,
        access_token: &str,
        expires_in: i64,
    ) -> anyhow::Result<()> {
        let mut accounts = self.load_accounts()?;
        
        for account in &mut accounts {
            if account.id == account_id {
                account.access_token = Some(access_token.to_string());
                account.expires_at = Some(chrono::Utc::now().timestamp_millis() + (expires_in * 1000));
                break;
            }
        }
        
        self.save_accounts(&accounts)?;
        Ok(())
    }
    
    /// Add or update OAuth account
    pub fn add_or_update_oauth_account(
        &mut self,
        user_info: UserInfo,
        tokens: TokenData,
    ) -> anyhow::Result<Account> {
        let mut accounts = self.load_accounts()?;
        
        // Check if account exists
        if let Some(existing) = accounts.iter_mut().find(|a| a.email == user_info.email) {
            // Update existing
            existing.refresh_token = tokens.refresh_token;
            existing.access_token = Some(tokens.access_token);
            existing.expires_at = Some(chrono::Utc::now().timestamp_millis() + (tokens.expires_in * 1000));
            existing.name = user_info.name.or_else(|| Some(user_info.email.split('@').next().unwrap_or("Unknown").to_string()));
            existing.picture = user_info.picture;
            
            let account = existing.clone();
            self.save_accounts(&accounts)?;
            return Ok(account);
        }
        
        // Add new
        let account = Account {
            id: Uuid::new_v4().to_string(),
            email: user_info.email.clone(),
            name: user_info.name.or_else(|| Some(user_info.email.split('@').next().unwrap_or("Unknown").to_string())),
            picture: user_info.picture,
            refresh_token: tokens.refresh_token,
            access_token: Some(tokens.access_token),
            expires_at: Some(chrono::Utc::now().timestamp_millis() + (tokens.expires_in * 1000)),
            is_active: accounts.is_empty(),
            added_at: chrono::Utc::now().timestamp_millis(),
            last_switched: None,
            last_checked: None,
        };
        
        accounts.push(account.clone());
        self.save_accounts(&accounts)?;
        
        Ok(account)
    }
    
    /// Import accounts from JSON
    pub fn import_accounts(&mut self, imported: Vec<Account>) -> anyhow::Result<(usize, usize)> {
        let mut accounts = self.load_accounts()?;
        let mut added = 0;
        let mut updated = 0;
        let mut skipped = 0;
        
        for mut imported_account in imported {
            // Validate required fields
            if imported_account.email.is_empty() {
                eprintln!("Skipping account with empty email");
                skipped += 1;
                continue;
            }
            
            if imported_account.refresh_token.is_empty() {
                eprintln!("Skipping account {} with empty refresh_token", imported_account.email);
                skipped += 1;
                continue;
            }
            
            // Validate email format (basic check)
            if !imported_account.email.contains('@') {
                eprintln!("Skipping account with invalid email format: {}", imported_account.email);
                skipped += 1;
                continue;
            }
            
            // Ensure unique ID
            if imported_account.id.is_empty() || accounts.iter().any(|a| a.id == imported_account.id) {
                imported_account.id = Uuid::new_v4().to_string();
            }
            
            // Set default name if None or empty
            if imported_account.name.is_none() || imported_account.name.as_ref().map(|s| s.is_empty()).unwrap_or(true) {
                imported_account.name = Some(imported_account.email.split('@').next().unwrap_or("Unknown").to_string());
            }
            
            if let Some(existing) = accounts.iter_mut().find(|a| a.email == imported_account.email) {
                // Update existing - preserve added_at timestamp
                imported_account.added_at = existing.added_at;
                *existing = imported_account;
                updated += 1;
            } else {
                // Add new
                accounts.push(imported_account);
                added += 1;
            }
        }
        
        if added == 0 && updated == 0 && skipped > 0 {
            anyhow::bail!(
                "No valid accounts found to import. {} accounts were skipped due to missing email or refresh_token.",
                skipped
            );
        }
        
        self.save_accounts(&accounts)?;
        Ok((added, updated))
    }
}

/// Get the data directory for the application
pub fn get_data_dir() -> anyhow::Result<PathBuf> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?;
    
    Ok(home_dir.join(".antigravity-manager"))
}
