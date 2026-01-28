// OAuth handling - token refresh and user info

use serde::{Deserialize, Serialize};
use std::env;

const REDIRECT_URI: &str = "http://localhost:3847/auth/callback";

// Compile-time environment variables (set during CI/build)
const CLIENT_ID_COMPILE_TIME: Option<&str> = option_env!("GOOGLE_CLIENT_ID");
const CLIENT_SECRET_COMPILE_TIME: Option<&str> = option_env!("GOOGLE_CLIENT_SECRET");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub id_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
}

/// Get Google OAuth Client ID (compile-time first, then runtime)
fn get_client_id() -> anyhow::Result<String> {
    // First try compile-time env var (for CI builds)
    if let Some(id) = CLIENT_ID_COMPILE_TIME {
        if !id.is_empty() && id != "YOUR_CLIENT_ID" {
            return Ok(id.to_string());
        }
    }
    
    // Then try runtime env var (for local dev)
    if let Ok(id) = env::var("GOOGLE_CLIENT_ID") {
        if !id.is_empty() && id != "YOUR_CLIENT_ID" {
            return Ok(id);
        }
    }
    
    Err(anyhow::anyhow!(
        "GOOGLE_CLIENT_ID not set.\n\n\
        Please set up your Google OAuth credentials:\n\
        1. Go to https://console.cloud.google.com/apis/credentials\n\
        2. Create OAuth 2.0 credentials (Web application)\n\
        3. Add http://localhost:3847/auth/callback as an authorized redirect URI\n\
        4. Set GOOGLE_CLIENT_ID as an environment variable or in GitHub repository secrets"
    ))
}

/// Get Google OAuth Client Secret (compile-time first, then runtime)
fn get_client_secret() -> anyhow::Result<String> {
    // First try compile-time env var (for CI builds)
    if let Some(secret) = CLIENT_SECRET_COMPILE_TIME {
        if !secret.is_empty() && secret != "YOUR_CLIENT_SECRET" {
            return Ok(secret.to_string());
        }
    }
    
    // Then try runtime env var (for local dev)
    if let Ok(secret) = env::var("GOOGLE_CLIENT_SECRET") {
        if !secret.is_empty() && secret != "YOUR_CLIENT_SECRET" {
            return Ok(secret);
        }
    }
    
    Err(anyhow::anyhow!(
        "GOOGLE_CLIENT_SECRET not set.\n\n\
        Please set up your Google OAuth credentials:\n\
        1. Go to https://console.cloud.google.com/apis/credentials\n\
        2. Create OAuth 2.0 credentials (Web application)\n\
        3. Set GOOGLE_CLIENT_SECRET as an environment variable or in GitHub repository secrets"
    ))
}

/// Get OAuth authorization URL
pub fn get_auth_url() -> anyhow::Result<String> {
    let client_id = get_client_id()?;
    
    let scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/cloud-platform",
    ];
    
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        client_id,
        REDIRECT_URI,
        scopes.join("%20")
    );
    
    Ok(auth_url)
}

/// Exchange authorization code for tokens
pub async fn exchange_code_for_tokens(code: &str) -> anyhow::Result<TokenData> {
    let client_id = get_client_id()?;
    let client_secret = get_client_secret()?;
    
    let client = reqwest::Client::new();
    
    let params = [
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("code", code),
        ("redirect_uri", REDIRECT_URI),
        ("grant_type", "authorization_code"),
    ];
    
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await?;
        anyhow::bail!("Token exchange failed: {}", error_text);
    }
    
    let token_response: serde_json::Value = response.json().await?;
    
    Ok(TokenData {
        access_token: token_response["access_token"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing access_token"))?
            .to_string(),
        refresh_token: token_response["refresh_token"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing refresh_token - make sure you included 'access_type=offline' and 'prompt=consent' in the auth URL"))?
            .to_string(),
        expires_in: token_response["expires_in"]
            .as_i64()
            .unwrap_or(3600),
        id_token: token_response["id_token"].as_str().map(|s| s.to_string()),
    })
}

/// Refresh access token using refresh token
pub async fn refresh_access_token(refresh_token: &str) -> anyhow::Result<TokenData> {
    let client_id = get_client_id()?;
    let client_secret = get_client_secret()?;
    
    let client = reqwest::Client::new();
    
    let params = [
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];
    
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await?;
        anyhow::bail!("Token refresh failed: {}", error_text);
    }
    
    let token_response: serde_json::Value = response.json().await?;
    
    Ok(TokenData {
        access_token: token_response["access_token"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing access_token in refresh response"))?
            .to_string(),
        refresh_token: refresh_token.to_string(), // Keep the original refresh token
        expires_in: token_response["expires_in"]
            .as_i64()
            .unwrap_or(3600),
        id_token: token_response["id_token"].as_str().map(|s| s.to_string()),
    })
}

/// Fetch user info using access token
pub async fn fetch_user_info(access_token: &str) -> anyhow::Result<UserInfo> {
    let client = reqwest::Client::new();
    
    let response = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await?;
        anyhow::bail!("Failed to fetch user info: {}", error_text);
    }
    
    let user_info: serde_json::Value = response.json().await?;
    
    Ok(UserInfo {
        email: user_info["email"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing email in user info"))?
            .to_string(),
        name: user_info["name"].as_str().map(|s| s.to_string()),
        picture: user_info["picture"].as_str().map(|s| s.to_string()),
    })
}

/// Start local OAuth callback server and wait for authorization code
pub async fn start_oauth_server() -> anyhow::Result<String> {
    use tokio::net::TcpListener;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use std::time::Duration;
    
    let listener = TcpListener::bind("127.0.0.1:3847").await?;
    println!("OAuth callback server listening on http://localhost:3847");
    
    // Set a timeout for the OAuth callback (5 minutes)
    let timeout = tokio::time::timeout(Duration::from_secs(300), async {
        loop {
            let (mut socket, _) = listener.accept().await?;
            let mut buffer = [0u8; 4096];
            let n = socket.read(&mut buffer).await?;
            let request = String::from_utf8_lossy(&buffer[..n]);
            
            // Parse the request to extract the authorization code
            if let Some(code) = extract_auth_code(&request) {
                // Send success response to browser
                let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
                    <!DOCTYPE html>\
                    <html><head><title>Success</title></head>\
                    <body style='font-family: sans-serif; text-align: center; padding: 50px;'>\
                    <h1 style='color: #4CAF50;'>✓ Authorization Successful</h1>\
                    <p>You can close this window and return to the app.</p>\
                    </body></html>";
                socket.write_all(response.as_bytes()).await?;
                socket.flush().await?;
                return Ok::<String, anyhow::Error>(code);
            } else if request.contains("error=") {
                // Handle error response
                let error = extract_error(&request).unwrap_or_else(|| "Unknown error".to_string());
                let response = format!("HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\n\r\n\
                    <!DOCTYPE html>\
                    <html><head><title>Error</title></head>\
                    <body style='font-family: sans-serif; text-align: center; padding: 50px;'>\
                    <h1 style='color: #f44336;'>✗ Authorization Failed</h1>\
                    <p>{}</p>\
                    </body></html>", error);
                socket.write_all(response.as_bytes()).await?;
                socket.flush().await?;
                return Err(anyhow::anyhow!("OAuth error: {}", error));
            } else {
                // Not the callback request, continue listening
                let response = "HTTP/1.1 404 Not Found\r\n\r\n";
                let _ = socket.write_all(response.as_bytes()).await;
            }
        }
    });
    
    match timeout.await {
        Ok(Ok(code)) => Ok(code),
        Ok(Err(e)) => Err(e),
        Err(_) => Err(anyhow::anyhow!("OAuth timeout - no response received within 5 minutes")),
    }
}

/// Extract authorization code from HTTP request
fn extract_auth_code(request: &str) -> Option<String> {
    // Look for code parameter in the request line or body
    for line in request.lines() {
        if line.starts_with("GET /auth/callback") {
            if let Some(code_start) = line.find("code=") {
                let after_code = &line[code_start + 5..];
                let code_end = after_code.find(&[' ', '&'][..]).unwrap_or(after_code.len());
                let code = &after_code[..code_end];
                // URL decode the code
                return Some(url_decode(code));
            }
        }
    }
    None
}

/// Extract error from OAuth error response
fn extract_error(request: &str) -> Option<String> {
    for line in request.lines() {
        if line.starts_with("GET /auth/callback") {
            if let Some(error_start) = line.find("error=") {
                let after_error = &line[error_start + 6..];
                let error_end = after_error.find(&[' ', '&'][..]).unwrap_or(after_error.len());
                return Some(url_decode(&after_error[..error_end]));
            }
        }
    }
    None
}

/// Simple URL decode function
fn url_decode(s: &str) -> String {
    let mut result = String::new();
    let mut chars = s.chars().peekable();
    
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex1 = chars.next();
            let hex2 = chars.next();
            if let (Some(h1), Some(h2)) = (hex1, hex2) {
                if let Ok(byte) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) {
                    result.push(byte as char);
                } else {
                    result.push('%');
                    result.push(h1);
                    result.push(h2);
                }
            } else {
                result.push('%');
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }
    
    result
}
