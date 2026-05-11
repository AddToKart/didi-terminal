use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use reqwest::{Client, Method, header::{HeaderMap, HeaderName, HeaderValue}};

#[derive(Serialize, Deserialize, Debug)]
pub struct HttpRequestParams {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HttpResponseResult {
    status: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: String,
    time_ms: u64,
}

#[tauri::command]
pub async fn make_http_request(params: HttpRequestParams) -> Result<HttpResponseResult, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let method = match params.method.to_uppercase().as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        "PUT" => Method::PUT,
        "DELETE" => Method::DELETE,
        "PATCH" => Method::PATCH,
        "OPTIONS" => Method::OPTIONS,
        _ => Method::GET,
    };

    let mut header_map = HeaderMap::new();
    for (k, v) in params.headers {
        if let (Ok(name), Ok(value)) = (HeaderName::from_bytes(k.as_bytes()), HeaderValue::from_str(&v)) {
            header_map.insert(name, value);
        }
    }

    let mut builder = client.request(method, &params.url).headers(header_map);

    if let Some(b) = params.body {
        builder = builder.body(b);
    }

    let start_time = std::time::Instant::now();
    let response = builder.send().await.map_err(|e| e.to_string())?;
    let elapsed = start_time.elapsed().as_millis() as u64;

    let status = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("").to_string();
    
    let mut resp_headers = HashMap::new();
    for (k, v) in response.headers() {
        resp_headers.insert(k.as_str().to_string(), v.to_str().unwrap_or("").to_string());
    }

    let body = response.text().await.unwrap_or_default();

    Ok(HttpResponseResult {
        status,
        status_text,
        headers: resp_headers,
        body,
        time_ms: elapsed,
    })
}
