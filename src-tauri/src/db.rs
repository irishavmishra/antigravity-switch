// Database utilities for Antigravity

use std::path::PathBuf;
use std::process::Command;

/// Check if sqlite3 CLI is available
pub fn check_sqlite3() -> bool {
    Command::new("sqlite3")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

/// Execute a SQL query on the database
pub fn execute_query(db_path: &PathBuf, query: &str) -> anyhow::Result<String> {
    let output = Command::new("sqlite3")
        .arg(db_path)
        .arg(query)
        .output()?;
    
    if !output.status.success() {
        anyhow::bail!("SQLite query failed: {}", String::from_utf8_lossy(&output.stderr));
    }
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Check if a table exists
pub fn table_exists(db_path: &PathBuf, table_name: &str) -> anyhow::Result<bool> {
    let result = execute_query(
        db_path,
        &format!(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='{}';",
            table_name
        ),
    )?;
    
    Ok(!result.trim().is_empty())
}

/// Get the ItemTable schema
pub fn get_table_schema(db_path: &PathBuf) -> anyhow::Result<String> {
    execute_query(db_path, "PRAGMA table_info(ItemTable);")
}
