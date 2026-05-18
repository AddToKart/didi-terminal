use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::sync::Arc;
use tokio::sync::broadcast;
use tauri::{AppHandle, Listener};
use tower_http::cors::{Any, CorsLayer};
use serde_json::json;

pub struct DashboardState {
    pub tx: broadcast::Sender<String>,
}

pub fn start_dashboard_server(app_handle: AppHandle) {
    let (tx, _rx) = broadcast::channel(1024);
    let state = Arc::new(DashboardState { tx: tx.clone() });

    let tx_clone = tx.clone();
    app_handle.listen_any("pty-output", move |event| {
        if tx_clone.receiver_count() == 0 {
            return;
        }
        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            let msg = json!({
                "type": "pty-output",
                "payload": payload
            });
            let _ = tx_clone.send(msg.to_string());
        }
    });

    let tx_clone = tx.clone();
    app_handle.listen_any("agent-handoff", move |event| {
        if tx_clone.receiver_count() == 0 {
            return;
        }
        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            let msg = json!({
                "type": "agent-handoff",
                "payload": payload
            });
            let _ = tx_clone.send(msg.to_string());
        }
    });

    let tx_clone = tx.clone();
    app_handle.listen_any("agent-prompt-ready", move |event| {
        if tx_clone.receiver_count() == 0 {
            return;
        }
        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            let msg = json!({
                "type": "agent-prompt-ready",
                "payload": payload
            });
            let _ = tx_clone.send(msg.to_string());
        }
    });

    let tx_clone = tx.clone();
    app_handle.listen_any("sentinel-intervention", move |event| {
        if tx_clone.receiver_count() == 0 {
            return;
        }
        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            let msg = json!({
                "type": "sentinel-intervention",
                "payload": payload
            });
            let _ = tx_clone.send(msg.to_string());
        }
    });

    tauri::async_runtime::spawn(async move {
        // Restrict CORS to localhost origins only.
        // The dashboard is a local dev tool — no external origin should ever connect.
        let cors = CorsLayer::new()
            .allow_origin([
                "http://localhost:1421".parse().unwrap(),
                "http://127.0.0.1:1421".parse().unwrap(),
            ])
            .allow_methods(Any)
            .allow_headers(Any);

        let app = Router::new()
            .route("/ws", get(ws_handler))
            .layer(cors)
            .with_state(state);

        // Bind to localhost only (not 0.0.0.0) to prevent external network access.
        let addr = "127.0.0.1:1421";
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Failed to bind dashboard server to {}: {}", addr, e);
                return;
            }
        };

        println!("🚀 Didi Remote Dashboard Server active on http://{}", addr);
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("Dashboard server error: {}", e);
        }
    });
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<DashboardState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<DashboardState>) {
    let mut rx = state.tx.subscribe();

    let _ = socket.send(Message::Text(json!({
        "type": "system",
        "payload": "connected to Didi Bridge"
    }).to_string().into())).await;

    while let Ok(msg) = rx.recv().await {
        if socket.send(Message::Text(msg.into())).await.is_err() {
            break;
        }
    }
}
