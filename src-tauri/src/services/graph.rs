use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub path: String,
    pub type_info: String, // "frontend", "backend", "shared", etc.
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub label: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[tauri::command]
pub fn get_project_graph(cwd: String) -> Result<ProjectGraph, String> {
    let root = Path::new(&cwd);
    if !root.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut path_to_id = HashMap::new();

    // 1. Discover potential sub-projects
    discover_projects(root, root, 0, &mut nodes, &mut path_to_id);

    // 2. Analyze dependencies to create edges
    for node in &nodes {
        let node_path = Path::new(&node.path);
        
        // --- Dependency Edges ---
        // Check for package.json (Node/TS)
        if node_path.join("package.json").exists() {
            if let Ok(content) = fs::read_to_string(node_path.join("package.json")) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    for dep_type in ["dependencies", "devDependencies"] {
                        if let Some(deps) = json.get(dep_type).and_then(|d| d.as_object()) {
                            for (name, ver) in deps {
                                let ver_str = ver.as_str().unwrap_or("");
                                if ver_str.starts_with("workspace:") || ver_str.starts_with("link:") || ver_str.starts_with("file:") {
                                    if let Some(target) = nodes.iter().find(|n| n.name == *name) {
                                        edges.push(GraphEdge {
                                            id: format!("{}-dep-{}", node.id, target.id),
                                            source: node.id.clone(),
                                            target: target.id.clone(),
                                            label: dep_type.to_string(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check for Cargo.toml (Rust)
        if node_path.join("Cargo.toml").exists() {
            if let Ok(content) = fs::read_to_string(node_path.join("Cargo.toml")) {
                for line in content.lines() {
                    if line.contains("path =") {
                        if let Some(target) = nodes.iter().find(|n| line.contains(&n.name)) {
                            edges.push(GraphEdge {
                                id: format!("{}-cargo-{}", node.id, target.id),
                                source: node.id.clone(),
                                target: target.id.clone(),
                                label: "cargo-dep".to_string(),
                            });
                        }
                    }
                }
            }
        }

        // --- Hierarchical Edges (Fallback/Structure) ---
        // If a project is inside another project's directory, draw a structural edge.
        // Find the closest parent project.
        if node.path != root.to_string_lossy().to_string() {
            let mut parent: Option<&GraphNode> = None;
            for p in &nodes {
                if p.path != node.path && node.path.starts_with(&p.path) {
                    if let Some(current_parent) = parent {
                        if p.path.len() > current_parent.path.len() {
                            parent = Some(p);
                        }
                    } else {
                        parent = Some(p);
                    }
                }
            }
            if let Some(p) = parent {
                // Ensure we don't draw a structural edge if a dependency edge already exists
                let edge_id = format!("{}-struct-{}", p.id, node.id);
                if !edges.iter().any(|e| (e.source == p.id && e.target == node.id) || (e.source == node.id && e.target == p.id)) {
                    edges.push(GraphEdge {
                        id: edge_id,
                        source: p.id.clone(),
                        target: node.id.clone(),
                        label: "workspace".to_string(),
                    });
                }
            }
        }
    }

    Ok(ProjectGraph { nodes, edges })
}

fn discover_projects(dir: &Path, root: &Path, depth: u8, nodes: &mut Vec<GraphNode>, path_to_id: &mut HashMap<String, String>) {
    if depth > 4 { return; }

    let mut is_project = false;
    let mut type_info = "folder".to_string();

    if dir.join("package.json").exists() {
        is_project = true;
        type_info = "node".to_string();
    } else if dir.join("Cargo.toml").exists() {
        is_project = true;
        type_info = "rust".to_string();
    } else if dir.join("requirements.txt").exists() || dir.join("pyproject.toml").exists() {
        is_project = true;
        type_info = "python".to_string();
    }

    // Always include the root as a folder if it has no specific project type
    if dir == root && !is_project {
        is_project = true;
        type_info = "folder".to_string();
    }

    if is_project {
        let name = if dir == root {
            "root".to_string()
        } else {
            dir.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string()
        };
        
        let path_str = dir.to_string_lossy().to_string();
        let id = path_str.clone(); // Use absolute path as unique ID

        nodes.push(GraphNode {
            id: id.clone(),
            name,
            path: path_str.clone(),
            type_info,
        });
        path_to_id.insert(path_str, id);
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dirname = path.file_name().unwrap_or_default().to_string_lossy();
                if dirname != "node_modules" && dirname != "target" && dirname != ".git" && dirname != "dist" && !dirname.starts_with('.') {
                    discover_projects(&path, root, depth + 1, nodes, path_to_id);
                }
            }
        }
    }
}
