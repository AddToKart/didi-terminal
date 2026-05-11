use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::Row;
use sqlx::Column;
use sqlx::TypeInfo;

#[derive(Serialize, Deserialize, Debug)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
}

fn pg_value_to_json(row: &sqlx::postgres::PgRow, col: &sqlx::postgres::PgColumn) -> Value {
    let type_name = col.type_info().name();
    let i = col.ordinal();
    match type_name {
        "INT2" | "INT4" | "INT8" | "SMALLINT" | "INTEGER" | "BIGINT" => {
            if let Ok(v) = row.try_get::<i64, _>(i) { Value::Number(v.into()) }
            else { Value::Null }
        }
        "FLOAT4" | "FLOAT8" | "REAL" | "DOUBLE PRECISION" => {
            if let Ok(v) = row.try_get::<f64, _>(i) {
                serde_json::Number::from_f64(v).map(Value::Number).unwrap_or(Value::Null)
            } else { Value::Null }
        }
        "BOOL" => {
            if let Ok(v) = row.try_get::<bool, _>(i) { Value::Bool(v) }
            else { Value::Null }
        }
        _ => {
            // Try text for everything else (TEXT, VARCHAR, UUID, TIMESTAMP, JSONB, etc.)
            if let Ok(v) = row.try_get::<String, _>(i) { Value::String(v) }
            else { Value::Null }
        }
    }
}

#[tauri::command]
pub async fn db_query_postgres(connection_string: String, query: String) -> Result<QueryResult, String> {
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Query failed: {}", e))?;

    pool.close().await;

    if rows.is_empty() {
        return Ok(QueryResult { columns: vec![], rows: vec![] });
    }

    let columns: Vec<String> = rows[0].columns().iter().map(|c| c.name().to_string()).collect();
    let mut result_rows: Vec<Vec<Value>> = Vec::new();

    for row in &rows {
        let mut r: Vec<Value> = Vec::new();
        for col in row.columns() {
            r.push(pg_value_to_json(row, col));
        }
        result_rows.push(r);
    }

    Ok(QueryResult { columns, rows: result_rows })
}

#[tauri::command]
pub async fn db_get_postgres_tables(connection_string: String) -> Result<Vec<String>, String> {
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let rows = sqlx::query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    pool.close().await;

    let tables: Vec<String> = rows.iter()
        .map(|r| r.try_get::<String, _>(0).unwrap_or_default())
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
                serde_json::Number::from_f64(v).map(Value::Number).unwrap_or(Value::Null)
            } else { Value::Null }
        }
        "TINYINT(1)" => {
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
pub async fn db_query_mysql(connection_string: String, query: String) -> Result<QueryResult, String> {
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Query failed: {}", e))?;

    pool.close().await;

    if rows.is_empty() {
        return Ok(QueryResult { columns: vec![], rows: vec![] });
    }

    let columns: Vec<String> = rows[0].columns().iter().map(|c| c.name().to_string()).collect();
    let mut result_rows: Vec<Vec<Value>> = Vec::new();

    for row in &rows {
        let mut r: Vec<Value> = Vec::new();
        for col in row.columns() {
            r.push(mysql_value_to_json(row, col));
        }
        result_rows.push(r);
    }

    Ok(QueryResult { columns, rows: result_rows })
}

#[tauri::command]
pub async fn db_get_mysql_tables(connection_string: String) -> Result<Vec<String>, String> {
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&connection_string)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let rows = sqlx::query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    pool.close().await;

    let tables: Vec<String> = rows.iter()
        .map(|r| r.try_get::<String, _>(0).unwrap_or_default())
        .collect();

    Ok(tables)
}
