// Quota fetching from Antigravity/Google APIs

use serde::{Deserialize, Serialize};

use crate::account::Account;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelQuota {
    pub name: String,
    pub display_name: String,
    pub percentage: i32,
    pub reset_time: Option<String>,
    pub badge: Option<Badge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Badge {
    pub text: String,
    pub color: String,
    pub badge_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaInfo {
    pub models: Vec<ModelQuota>,
    pub error: Option<String>,
}

/// Fetch quota information for an account
pub async fn fetch_quota(account: &Account) -> anyhow::Result<QuotaInfo> {
    let access_token = account
        .access_token
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("No access token"))?;
    
    // First, get the project ID
    let project_id = fetch_project_id(access_token).await?;
    
    // Then fetch available models/quota
    let models = fetch_available_models(access_token, &project_id).await?;
    
    Ok(QuotaInfo {
        models,
        error: None,
    })
}

/// Fetch project ID from Cloud Code API
async fn fetch_project_id(access_token: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    
    let response = client
        .post("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "metadata": { "ideType": "ANTIGRAVITY" }
        }))
        .send()
        .await?;
    
    if response.status().as_u16() == 403 {
        anyhow::bail!("Access forbidden - check your permissions");
    }
    
    if !response.status().is_success() {
        anyhow::bail!("Failed to fetch project ID: {}", response.status());
    }
    
    let data: serde_json::Value = response.json().await?;
    
    let project_id = data["cloudaicompanionProject"]
        .as_str()
        .or_else(|| data["cloudaicompanion_project"].as_str())
        .unwrap_or("bamboo-precept-lgxtn");
    
    Ok(project_id.to_string())
}

/// Fetch available models and their quota
async fn fetch_available_models(access_token: &str, project_id: &str) -> anyhow::Result<Vec<ModelQuota>> {
    let client = reqwest::Client::new();
    
    let response = client
        .post("https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "project": project_id
        }))
        .send()
        .await?;
    
    if response.status().as_u16() == 403 {
        anyhow::bail!("Forbidden");
    }
    
    if !response.status().is_success() {
        anyhow::bail!("Failed to fetch models: {}", response.status());
    }
    
    let data: serde_json::Value = response.json().await?;
    let mut quotas = Vec::new();
    
    if let Some(models) = data["models"].as_object() {
        for (name, info) in models {
            if let Some(quota_info) = info["quotaInfo"].as_object() {
                let remaining_fraction = quota_info["remainingFraction"]
                    .as_f64()
                    .unwrap_or(0.0);
                
                let percentage = (remaining_fraction * 100.0) as i32;
                
                let display_name = normalize_model_name(name);
                
                let badge = if percentage <= 5 {
                    Some(Badge {
                        text: "Low".to_string(),
                        color: "#FF453A".to_string(),
                        badge_type: "warning".to_string(),
                    })
                } else {
                    None
                };
                
                quotas.push(ModelQuota {
                    name: name.clone(),
                    display_name,
                    percentage,
                    reset_time: quota_info["resetTime"].as_str().map(|s| s.to_string()),
                    badge,
                });
            }
        }
    }
    
    // Sort by priority
    quotas.sort_by(|a, b| {
        let priority_a = get_model_priority(&a.name);
        let priority_b = get_model_priority(&b.name);
        priority_a.cmp(&priority_b)
    });
    
    Ok(quotas)
}

/// Normalize model name for display
fn normalize_model_name(name: &str) -> String {
    let name_lower = name.to_lowercase();
    
    if name_lower.contains("claude") && name_lower.contains("sonnet") && !name_lower.contains("thinking") {
        "Claude Sonnet 4.5".to_string()
    } else if name_lower.contains("thinking") {
        if name_lower.contains("opus") {
            "Claude Opus 4.5 (Thinking)".to_string()
        } else {
            "Claude Sonnet 4.5 (Thinking)".to_string()
        }
    } else if name_lower.contains("opus") {
        "Claude Opus 4.5".to_string()
    } else if name_lower.contains("gemini") && name_lower.contains("pro") {
        if name_lower.contains("high") {
            "Gemini 3 Pro (High)".to_string()
        } else if name_lower.contains("low") {
            "Gemini 3 Pro (Low)".to_string()
        } else {
            "Gemini 3 Pro".to_string()
        }
    } else if name_lower.contains("gemini") && name_lower.contains("flash") {
        "Gemini 3 Flash".to_string()
    } else if name_lower.contains("gpt") && name_lower.contains("oss") {
        "GPT-OSS 120B".to_string()
    } else {
        // Clean up the name
        let clean = name.split('/').next_back().unwrap_or(name);
        clean.replace("-", " ").replace("_", " ")
    }
}

/// Get model priority for sorting
fn get_model_priority(name: &str) -> i32 {
    let name_lower = name.to_lowercase();
    
    if name_lower.contains("claude") && name_lower.contains("sonnet") && !name_lower.contains("thinking") {
        1
    } else if name_lower.contains("thinking") {
        2
    } else if name_lower.contains("opus") {
        3
    } else if name_lower.contains("gemini") && name_lower.contains("pro") {
        4
    } else if name_lower.contains("gemini") && name_lower.contains("flash") {
        5
    } else if name_lower.contains("gpt") {
        6
    } else {
        100
    }
}
