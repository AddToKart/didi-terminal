use tauri::State;

use crate::AppState;

pub fn llm_url(endpoint: &str, path: &str) -> String {
    format!("{}/{}", endpoint.trim_end_matches('/'), path.trim_start_matches('/'))
}

#[tauri::command]
pub async fn get_sidecar_status(state: State<'_, AppState>) -> Result<String, String> {
    let config = state.config.lock().unwrap().clone();
    let endpoint = config.llm_endpoint.trim();
    if endpoint.is_empty() {
        return Ok("Not configured".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;
    let mut request = client.get(llm_url(endpoint, "models"));
    if !config.llm_api_key.trim().is_empty() {
        request = request.bearer_auth(config.llm_api_key.trim());
    }

    match request.send().await {
        Ok(response) if response.status().is_success() => Ok("Connected".to_string()),
        Ok(response) if response.status().as_u16() == 401 || response.status().as_u16() == 403 => Ok("Auth required".to_string()),
        Ok(response) => Ok(format!("HTTP {}", response.status().as_u16())),
        Err(_) => Ok("Unreachable".to_string()),
    }
}

#[tauri::command]
pub async fn ask_llm(prompt: String, system: String, state: State<'_, AppState>) -> Result<String, String> {
    let config = state.config.lock().unwrap().clone();
    let endpoint = config.llm_endpoint.trim().to_string();
    if endpoint.is_empty() {
        return Err("LLM endpoint is not configured.".to_string());
    }
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let model = if config.llm_model.trim().is_empty() {
        "local-model"
    } else {
        config.llm_model.trim()
    };

    let payload = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    });

    let mut request = client
        .post(llm_url(&endpoint, "chat/completions"))
        .json(&payload);
    if !config.llm_api_key.trim().is_empty() {
        request = request.bearer_auth(config.llm_api_key.trim());
    }

    let res = request.send().await.map_err(|e| {
        format!(
            "LLM request failed. Check that {} is running and reachable. {}",
            endpoint, e
        )
    })?;

    let status = res.status();
    let body = res.text().await.map_err(|e| format!("LLM response read failed: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "LLM request returned HTTP {}: {}",
            status.as_u16(),
            body.chars().take(500).collect::<String>()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&body).map_err(|e| format!("JSON error: {}", e))?;
    
    if let Some(content) = json["choices"][0]["message"]["content"].as_str() {
        Ok(content.to_string())
    } else {
        Err("Failed to parse response".to_string())
    }
}
