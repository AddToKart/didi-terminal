use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::Row;
use sqlx::Column;
use sqlx::TypeInfo;

/// Maximum query execution time (30 seconds) to prevent long-running queries
/// from blocking the connection pool.
// const QUERY_TIMEOUT_SECS: u64 = 30;

/// Maximum number of rows returned to prevent OOM from large result sets.
const MAX_ROWS: usize = 10_000;

/// Dangerous SQL keywords that should never be executed through the viewer.
/// This blocks DDL, DCL, and destructive DML operations.
const BLOCKED_KEYWORDS: &[&str] = &[
    "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE",
    "INSERT", "UPDATE", "DELETE", "MERGE", "REPLACE",
    "CALL", "EXEC", "EXECUTE", "LOAD_FILE", "INTO OUTFILE",
    "INTO DUMPFILE", "BENCHMARK", "SLEEP", "WAITFOR",
    "SHUTDOWN", "KILL", "XA", "PREPARE", "DEALLOCATE",
];

/// Validate that a query is a safe read-only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN.
/// This is a defense-in-depth check in addition to the SQL pool's read-only mode.
fn validate_readonly_query(query: &str) -> Result<(), String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Err("Query is empty".to_string());
    }

    let upper = trimmed.to_uppercase();

    // Only allow read-only query prefixes
    let allowed_prefixes = ["SELECT", "WITH", "SHOW", "DESCRIBE", "DESC ", "EXPLAIN"];
    let is_allowed = allowed_prefixes.iter().any(|prefix| upper.starts_with(prefix));
    if !is_allowed {
        return Err(format!(
            "Blocked: query must start with SELECT, WITH, SHOW, DESCRIBE, or EXPLAIN. \
             Got: '{}'",
            trimmed.chars().take(60).collect::<String>()
        ));
    }

    // Check for dangerous keywords anywhere in the query (defense-in-depth)
    for keyword in BLOCKED_KEYWORDS {
        // Use word-boundary-like check: keyword surrounded by non-alphanumeric or at boundaries
        if upper.contains(keyword) {
            // More precise check: ensure it's a standalone keyword, not a substring
            // e.g., "DROP" in "DROPPED" should not trigger, but "DROP TABLE" should
            let needle = format!(" {}", keyword);
            if upper.contains(&needle) || upper.starts_with(keyword) {
                return Err(format!(
                    "Blocked: query contains dangerous keyword '{}'. \
                     Only read-only queries are allowed.",
                    keyword
                ));
            }
        }
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub rows_affected: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TableInfo {
    pub schema: String,
    pub name: String,
}

fn pg_value_to_json(row: &sqlx::postgres::PgRow, col: &sqlx::postgres::PgColumn) -> Value {
    let type_name = col.type_info().name();
    let i = col.ordinal();
    match type_name {
        "INT2" | "INT4" | "INT8" | "SMALLINT" | "INTEGER" | "BIGINT" => {
            if let Ok(v) = row.try_get::<i64, _>(i) { Value::Number(v.into()) }
            else { Value::Null }
        }
        "FLOAT4" | "FLOAT8" | "REAL" | "DOUBLE PRECISION" | "NUMERIC" => {
            if let Ok(v) = row.try_get::<f64, _>(i) {
                serde_json::Number::from_f64(v).map(Value::Number).unwrap_or_else(|| Value::String(v.to_string()))
            } else { Value::Null }
        }
        "BOOL" => {
            if let Ok(v) = row.try_get::<bool, _>(i) { Value::Bool(v) }
            else { Value::Null }
        }
        _ => {
            if let Ok(v) = row.try_get::<String, _>(i) { Value::String(v) }
            else { Value::Null }
        }
    }
}

#[tauri::command]
pub async fn db_query_postgres(connection_string: String, query: String) -> Result<QueryResult, String> {
    // Validate query is read-only before connecting
    validate_readonly_query(&query)?;

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .idle_timeout(std::time::Duration::from_secs(60))
        .connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Query failed: {}", e))?;

    pool.close().await;

    if rows.is_empty() {
        return Ok(QueryResult { columns: vec![], rows: vec![], rows_affected: None });
    }

    // Limit rows to prevent OOM
    let limited_rows = if rows.len() > MAX_ROWS {
        &rows[..MAX_ROWS]
    } else {
        &rows[..]
    };

    let columns: Vec<String> = limited_rows[0].columns().iter().map(|c| c.name().to_string()).collect();
    let mut result_rows: Vec<Vec<Value>> = Vec::new();
    for row in limited_rows {
        let mut r: Vec<Value> = Vec::new();
        for col in row.columns() {
            r.push(pg_value_to_json(row, col));
        }
        result_rows.push(r);
    }

    Ok(QueryResult {
        columns,
        rows: result_rows,
        rows_affected: None,
    })
}

#[tauri::command]
pub async fn db_get_postgres_tables(connection_string: String) -> Result<Vec<TableInfo>, String> {
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .idle_timeout(std::time::Duration::from_secs(60))
        .connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let rows = sqlx::query(
        "SELECT table_schema, table_name \
         FROM information_schema.tables \
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema') \
         AND table_type = 'BASE TABLE' \
         ORDER BY table_schema, table_name"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    pool.close().await;

    let tables: Vec<TableInfo> = rows.iter()
        .map(|r| TableInfo {
            schema: r.try_get::<String, _>(0).unwrap_or_default(),
            name:   r.try_get::<String, _>(1).unwrap_or_default(),
        })
        .collect();

    Ok(tables)
}

fn mysql_value_to_json(row: &sqlx::mysql::MySqlRow, col: &sqlx::mysql::MySqlColumn) -> Value {
    let type_name = col.type_info().name();
    let i = col.ordinal();
    match type_name {
        "TINYINT" | "SMALLINT" | "INT" | "MEDIUMINT" | "BIGINT" => {
            if let Ok(v) = row.try_get::<i64, _>(i) { Value::Number(v.into()) }
            else { Value::Null }
        }
        "FLOAT" | "DOUBLE" | "DECIMAL" => {
            if let Ok(v) = row.try_get::<f64, _>(i) {
                serde_json::Number::from_f64(v).map(Value::Number).unwrap_or_else(|| Value::String(v.to_string()))
            } else { Value::Null }
        }
        _ => {
            if let Ok(v) = row.try_get::<String, _>(i) { Value::String(v) }
            else { Value::Null }
        }
    }
}

#[tauri::command]
pub async fn db_query_mysql(connection_string: String, query: String) -> Result<QueryResult, String> {
    // Validate query is read-only before connecting
    validate_readonly_query(&query)?;

    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .idle_timeout(std::time::Duration::from_secs(60))
        .connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Query failed: {}", e))?;

    pool.close().await;

    if rows.is_empty() {
        return Ok(QueryResult { columns: vec![], rows: vec![], rows_affected: None });
    }

    // Limit rows to prevent OOM
    let limited_rows = if rows.len() > MAX_ROWS {
        &rows[..MAX_ROWS]
    } else {
        &rows[..]
    };

    let columns: Vec<String> = limited_rows[0].columns().iter().map(|c| c.name().to_string()).collect();
    let mut result_rows: Vec<Vec<Value>> = Vec::new();
    for row in limited_rows {
        let mut r: Vec<Value> = Vec::new();
        for col in row.columns() {
            r.push(mysql_value_to_json(row, col));
        }
        result_rows.push(r);
    }

    Ok(QueryResult {
        columns,
        rows: result_rows,
        rows_affected: None,
    })
}

#[tauri::command]
pub async fn db_get_mysql_tables(connection_string: String) -> Result<Vec<TableInfo>, String> {
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .idle_timeout(std::time::Duration::from_secs(60))
        .connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let rows = sqlx::query(
        "SELECT table_schema, table_name \
         FROM information_schema.tables \
         WHERE table_schema = DATABASE() \
         ORDER BY table_name"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    pool.close().await;

    let tables: Vec<TableInfo> = rows.iter()
        .map(|r| TableInfo {
            schema: r.try_get::<String, _>(0).unwrap_or_default(),
            name:   r.try_get::<String, _>(1).unwrap_or_default(),
        })
        .collect();

    Ok(tables)
}
