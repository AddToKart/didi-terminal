use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::ToSocketAddrs;
use reqwest::{Client, Method, header::{HeaderMap, HeaderName, HeaderValue}};

/// Maximum response body size (10 MB) to prevent OOM from large responses.
const MAX_RESPONSE_BYTES: usize = 10 * 1024 * 1024;

/// Blocked IP ranges (private/reserved) to prevent SSRF.
/// Covers RFC 1918, loopback, link-local, carrier-grade NAT, documentation,
/// benchmarking, and reserved ranges.
fn is_private_or_reserved(ip: std::net::IpAddr) -> bool {
    use std::net::IpAddr;

    match ip {
        IpAddr::V4(addr) => {
            addr.is_private()
                || addr.is_loopback()
                || addr.is_link_local()
                || addr.is_broadcast()
                || addr.is_documentation()
                || addr.octets()[0] == 100 && (addr.octets()[1] & 0b1100_0000) == 0b0100_0000 // 100.64.0.0/10 CGNAT
                || addr.octets()[0] == 169 && addr.octets()[1] == 254 // 169.254.0.0/16 link-local
                || addr.octets()[0] == 192 && addr.octets()[1] == 0 && addr.octets()[2] == 0 // 192.0.0.0/24 IETF
                || addr.octets()[0] == 198 && addr.octets()[1] == 18 // 198.18.0.0/15 benchmarking
                || addr.octets()[0] == 198 && addr.octets()[1] == 51 && addr.octets()[2] == 100 // 198.51.100.0/24 TEST-NET-2
                || addr.octets()[0] == 203 && addr.octets()[1] == 0 && addr.octets()[2] == 113 // 203.0.113.0/24 TEST-NET-3
                || addr.octets()[0] >= 240 // 240.0.0.0/4 reserved
        }
        IpAddr::V6(addr) => {
            addr.is_loopback()
                || addr.is_unspecified()
                || ((addr.segments()[0] == 0xfe80) || (addr.segments()[0] & 0xffc0) == 0xfe80) // link-local
                || (addr.segments()[0] == 0xfc00 || addr.segments()[0] == 0xfd00) // ULA fc00::/7
                || addr.segments()[0] == 0x2001 && addr.segments()[1] == 0xdb8 // documentation 2001:db8::/32
        }
    }
}

/// Resolve hostname and check if all resolved IPs are safe (not private/reserved).
fn validate_url_host(url: &url::Url) -> Result<(), String> {
    let host = url.host_str().ok_or("URL has no host")?;

    // Block localhost variants explicitly
    if host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "0.0.0.0" {
        return Err(format!(
            "Blocked: host '{}' resolves to a loopback address. \
             The HTTP Lab is for external API testing only.",
            host
        ));
    }

    // Resolve all IPs for the hostname
    let addrs: Vec<std::net::IpAddr> = (host, 0)
        .to_socket_addrs()
        .map_err(|e| format!("DNS resolution failed for '{}': {}", host, e))?
        .map(|a: std::net::SocketAddr| a.ip())
        .collect();

    if addrs.is_empty() {
        return Err(format!("No IP addresses resolved for '{}'", host));
    }

    for addr in &addrs {
        if is_private_or_reserved(*addr) {
            return Err(format!(
                "Blocked: host '{}' resolves to private/reserved IP '{}'. \
                 The HTTP Lab is for external API testing only.",
                host, addr
            ));
        }
    }

    Ok(())
}

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
        "HEAD" => Method::HEAD,
        _ => return Err(format!("Unsupported HTTP method: {}", params.method)),
    };

    // Parse and validate URL
    let parsed_url = url::Url::parse(&params.url)
        .map_err(|e| format!("Invalid URL: {}", e))?;

    // Only allow http/https schemes
    let scheme = parsed_url.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!(
            "Blocked: only http/https schemes are allowed, got '{}'",
            scheme
        ));
    }

    // SSRF protection: validate resolved IPs
    validate_url_host(&parsed_url)?;

    // Build headers with validation
    let mut header_map = HeaderMap::new();
    for (k, v) in params.headers {
        // Skip headers that could be used for SSRF or request smuggling
        let lower = k.to_lowercase();
        if lower == "host" || lower == "connection" || lower == "upgrade" {
            continue;
        }
        if let (Ok(name), Ok(value)) = (HeaderName::from_bytes(k.as_bytes()), HeaderValue::from_str(&v)) {
            header_map.insert(name, value);
        }
    }

    let mut builder = client.request(method, parsed_url.as_str()).headers(header_map);

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

    // Limit response body size to prevent OOM
    let body_bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if body_bytes.len() > MAX_RESPONSE_BYTES {
        return Err(format!(
            "Response body too large ({} bytes, max {} bytes)",
            body_bytes.len(),
            MAX_RESPONSE_BYTES
        ));
    }
    let body = String::from_utf8_lossy(&body_bytes).into_owned();

    Ok(HttpResponseResult {
        status,
        status_text,
        headers: resp_headers,
        body,
        time_ms: elapsed,
    })
}
