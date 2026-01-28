// Account switching - database injection and process management

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use crate::account::get_data_dir;

/// Kill Antigravity processes
pub async fn kill_antigravity() -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pkill")
            .args(["-9", "-i", "Antigravity"])
            .output();
        let _ = Command::new("pkill")
            .args(["-9", "-f", "Antigravity Helper"])
            .output();
    }
    
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "Antigravity.exe", "/T"])
            .output();
    }
    
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("pkill")
            .args(["-9", "-f", "antigravity"])
            .output();
    }
    
    Ok(())
}

/// Restart Antigravity
pub async fn restart_antigravity() -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Antigravity"])
            .spawn()?;
    }
    
    #[cfg(target_os = "windows")]
    {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?;
        let exe_path = home_dir
            .join("AppData")
            .join("Local")
            .join("Programs")
            .join("Antigravity")
            .join("Antigravity.exe");
        
        if exe_path.exists() {
            Command::new(&exe_path).spawn()?;
        } else {
            // Try to find it in Program Files
            let program_files = PathBuf::from("C:\\Program Files\\Antigravity\\Antigravity.exe");
            if program_files.exists() {
                Command::new(&program_files).spawn()?;
            } else {
                anyhow::bail!("Could not find Antigravity.exe");
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("antigravity").spawn();
    }
    
    Ok(())
}

/// Get the Antigravity database path
fn get_db_path() -> anyhow::Result<PathBuf> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?;
    
    #[cfg(target_os = "macos")]
    {
        Ok(home_dir
            .join("Library")
            .join("Application Support")
            .join("Antigravity")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"))
    }
    
    #[cfg(target_os = "windows")]
    {
        Ok(home_dir
            .join("AppData")
            .join("Roaming")
            .join("Antigravity")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"))
    }
    
    #[cfg(target_os = "linux")]
    {
        Ok(home_dir
            .join(".config")
            .join("Antigravity")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"))
    }
}

/// Clean lock files
pub fn clean_lock_files() {
    if let Ok(db_path) = get_db_path() {
        for suffix in [".vscdb-wal", ".vscdb-shm"] {
            let lock_path = db_path.to_string_lossy().replace(".vscdb", suffix);
            let _ = fs::remove_file(&lock_path);
        }
    }
}

/// Inject token into Antigravity database - FIXED VERSION
pub async fn inject_token_into_db(
    access_token: &str,
    refresh_token: &str,
    expiry: i64,
    email: &str,
) -> anyhow::Result<()> {
    let db_path = get_db_path()?;
    
    if !db_path.exists() {
        anyhow::bail!("Antigravity database not found at {:?}", db_path);
    }
    
    // Make database writable
    let _ = fs::set_permissions(&db_path, std::fs::Permissions::from_mode(0o644));
    
    // Try to use sqlite3 command line tool
    let jetski_key = "jetskiStateSync.agentManagerInitState";
    let auth_key = "antigravityAuthStatus";
    
    // Create OAuth field data (simplified protobuf-like encoding)
    let oauth_data = create_oauth_field(access_token, refresh_token, expiry);
    let oauth_base64 = base64::encode(&oauth_data);
    
    // Create auth status JSON
    let auth_json = serde_json::json!({
        "email": email,
        "apiKey": access_token,
        "name": email.split('@').next().unwrap_or("User")
    });
    
    // Try to update using sqlite3 CLI
    let update_result = update_db_with_sqlite3(&db_path, jetski_key, &oauth_base64, auth_key, &auth_json.to_string()).await;
    
    if update_result.is_err() {
        // Fallback: try direct file manipulation
        anyhow::bail!("Database update failed");
    }
    
    Ok(())
}

/// Update database using sqlite3 CLI
async fn update_db_with_sqlite3(
    db_path: &PathBuf,
    jetski_key: &str,
    oauth_value: &str,
    auth_key: &str,
    auth_value: &str,
) -> anyhow::Result<()> {
    // Check if jetski key exists
    let check_output = Command::new("sqlite3")
        .arg(db_path)
        .arg(format!("SELECT value FROM ItemTable WHERE key = '{}';", jetski_key))
        .output()?;
    
    let existing_value = String::from_utf8_lossy(&check_output.stdout);
    
    if existing_value.trim().is_empty() {
        // Insert new record
        let _ = Command::new("sqlite3")
            .arg(db_path)
            .arg(format!(
                "INSERT INTO ItemTable (key, value) VALUES ('{}', '{}');",
                jetski_key, oauth_value
            ))
            .output()?;
    } else {
        // Update existing record
        let _ = Command::new("sqlite3")
            .arg(db_path)
            .arg(format!(
                "UPDATE ItemTable SET value = '{}' WHERE key = '{}';",
                oauth_value, jetski_key
            ))
            .output()?;
    }
    
    // Update auth status
    let _ = Command::new("sqlite3")
        .arg(db_path)
        .arg(format!(
            "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('{}', '{}');",
            auth_key, auth_value
        ))
        .output()?;
    
    // Clear cache keys
    let cache_keys = [
        "google.geminicodeassist",
        "google.geminicodeassist.hasRunOnce",
        "geminiCodeAssist.chatThreads",
    ];
    
    for key in &cache_keys {
        let _ = Command::new("sqlite3")
            .arg(db_path)
            .arg(format!(
                "DELETE FROM ItemTable WHERE key = '{}' OR key LIKE '{}.%';",
                key, key
            ))
            .output()?;
    }
    
    Ok(())
}

/// Create OAuth field in protobuf-like format
fn create_oauth_field(access_token: &str, refresh_token: &str, expiry: i64) -> Vec<u8> {
    let mut parts = Vec::new();
    
    // Field 1: access_token
    add_string_field(&mut parts, 1, access_token);
    
    // Field 2: token_type (Bearer)
    add_string_field(&mut parts, 2, "Bearer");
    
    // Field 3: refresh_token
    add_string_field(&mut parts, 3, refresh_token);
    
    // Field 4: expiry timestamp
    let mut timestamp_parts = Vec::new();
    add_varint(&mut timestamp_parts, (1 << 3) | 0); // Field 1, wire type 0
    add_varint(&mut timestamp_parts, expiry as u64);
    
    add_varint(&mut parts, (4 << 3) | 2); // Field 4, wire type 2 (length-delimited)
    add_varint(&mut parts, timestamp_parts.len() as u64);
    parts.extend_from_slice(&timestamp_parts);
    
    // Wrap in field 6
    let mut result = Vec::new();
    add_varint(&mut result, (6 << 3) | 2); // Field 6, wire type 2
    add_varint(&mut result, parts.len() as u64);
    result.extend_from_slice(&parts);
    
    result
}

/// Add a string field to protobuf
fn add_string_field(parts: &mut Vec<u8>, field_num: u32, value: &str) {
    add_varint(parts, (field_num << 3) | 2); // Wire type 2 = length-delimited
    add_varint(parts, value.len() as u64);
    parts.extend_from_slice(value.as_bytes());
}

/// Encode a value as varint
fn add_varint(parts: &mut Vec<u8>, mut value: u64) {
    while value >= 0x80 {
        parts.push(((value & 0x7F) | 0x80) as u8);
        value >>= 7;
    }
    parts.push(value as u8);
}

// Base64 encoding module
mod base64 {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    
    pub fn encode(data: &[u8]) -> String {
        let mut result = String::new();
        let mut i = 0;
        
        while i < data.len() {
            let b1 = data[i];
            let b2 = if i + 1 < data.len() { data[i + 1] } else { 0 };
            let b3 = if i + 2 < data.len() { data[i + 2] } else { 0 };
            
            let idx1 = (b1 >> 2) as usize;
            let idx2 = (((b1 & 0x03) << 4) | (b2 >> 4)) as usize;
            let idx3 = (((b2 & 0x0F) << 2) | (b3 >> 6)) as usize;
            let idx4 = (b3 & 0x3F) as usize;
            
            result.push(ALPHABET[idx1] as char);
            result.push(ALPHABET[idx2] as char);
            
            if i + 1 < data.len() {
                result.push(ALPHABET[idx3] as char);
            } else {
                result.push('=');
            }
            
            if i + 2 < data.len() {
                result.push(ALPHABET[idx4] as char);
            } else {
                result.push('=');
            }
            
            i += 3;
        }
        
        result
    }
}

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
