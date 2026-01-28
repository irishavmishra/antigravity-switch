// OAuth handling - token refresh and user info

use serde::{Deserialize, Serialize};

const CLIENT_ID: &str = "YOUR_CLIENT_ID"; // Replace with actual client ID
const CLIENT_SECRET: &str = "YOUR_CLIENT_SECRET"; // Replace with actual client secret
const REDIRECT_URI: &str = "http://localhost:3847/auth/callback";

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

/// Get OAuth authorization URL
pub fn get_auth_url() -> anyhow::Result<String> {
    let scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/cloud-platform",
    ];
    
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        CLIENT_ID,
        REDIRECT_URI,
        scopes.join("%20")
    );
    
    Ok(auth_url)
}

/// Exchange authorization code for tokens
pub async fn exchange_code_for_tokens(code: &str) -> anyhow::Result<TokenData> {
    let client = reqwest::Client::new();
    
    let params = [
        ("client_id", CLIENT_ID),
        ("client_secret", CLIENT_SECRET),
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
            .ok_or_else(|| anyhow::anyhow!("Missing refresh_token"))?
            .to_string(),
        expires_in: token_response["expires_in"]
            .as_i64()
            .unwrap_or(3600),
        id_token: token_response["id_token"].as_str().map(|s| s.to_string()),
    })
}

/// Refresh access token using refresh token
pub async fn refresh_access_token(refresh_token: &str) -> anyhow::Result<TokenData> {
    let client = reqwest::Client::new();
    
    let params = [
        ("client_id", CLIENT_ID),
        ("client_secret", CLIENT_SECRET),
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
            .ok_or_else(|| anyhow::anyhow!("Missing access_token"))?
            .to_string(),
        refresh_token: refresh_token.to_string(), // Keep the same refresh token
        expires_in: token_response["expires_in"]
            .as_i64()
            .unwrap_or(3600),
        id_token: token_response["id_token"].as_str().map(|s| s.to_string()),
    })
}

/// Get user info from access token
pub async fn get_user_info(access_token: &str) -> anyhow::Result<UserInfo> {
    let client = reqwest::Client::new();
    
    let response = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await?;
        anyhow::bail!("Failed to get user info: {}", error_text);
    }
    
    let user_info: serde_json::Value = response.json().await?;
    
    Ok(UserInfo {
        email: user_info["email"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing email"))?
            .to_string(),
        name: user_info["name"].as_str().map(|s| s.to_string()),
        picture: user_info["picture"].as_str().map(|s| s.to_string()),
    })
}
