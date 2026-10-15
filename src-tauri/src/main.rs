#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

struct BackgroundServer(Mutex<Option<Child>>);

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NativeEngineInfo {
    pub id: String,
    pub name: String,
    pub socket_path: String,
    pub app_path: Option<String>,
    pub status: String,
    pub is_default: bool,
}

#[tauri::command]
fn check_fullscreen(window: tauri::Window) -> bool {
    if !window.is_fullscreen().unwrap_or(false) {
        return false;
    }
    if let Ok(Some(monitor)) = window.current_monitor() {
        if let Ok(size) = window.inner_size() {
            let mon_size = monitor.size();
            if size.width < mon_size.width.saturating_sub(20) || size.height < mon_size.height.saturating_sub(100) {
                return false;
            }
        }
    }
    true
}

#[tauri::command]
fn drag_window(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_native_window(

    app: tauri::AppHandle,
    window_id: String,
    title: String,
    url: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let sanitized_id: String = window_id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();

    if let Some(existing) = app.get_webview_window(&sanitized_id) {
        let _ = existing.set_focus();
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(&app, &sanitized_id, tauri::WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(width, height)
        .min_inner_size(480.0, 320.0)
        .resizable(true)
        .decorations(true)
        .disable_drag_drop_handler()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn broadcast_theme_settings(app: tauri::AppHandle, js_code: String) {
    for (_, window) in app.webview_windows() {
        let _ = window.eval(&js_code);
    }
}

fn get_docker_exec_command() -> (String, Vec<PathBuf>) {
    #[cfg(target_os = "windows")]
    {
        let mut extra_dirs = Vec::new();
        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        extra_dirs.push(PathBuf::from(format!("{}\\Docker\\Docker\\resources\\bin", program_files)));
        extra_dirs.push(PathBuf::from(format!("{}\\Docker\\Docker\\resources", program_files)));
        extra_dirs.push(PathBuf::from(format!("{}\\RedHat\\Podman", program_files)));

        let candidates = [
            format!("{}\\Docker\\Docker\\resources\\bin\\docker.exe", program_files),
            format!("{}\\Docker\\Docker\\resources\\docker.exe", program_files),
            "docker.exe".to_string(),
            "docker".to_string(),
        ];
        for c in &candidates {
            if Path::new(c).exists() {
                return (c.clone(), extra_dirs);
            }
        }
        ("docker".to_string(), extra_dirs)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let extra_dirs = vec![
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/opt/homebrew/sbin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/bin"),
            PathBuf::from("/usr/sbin"),
            PathBuf::from("/sbin"),
            PathBuf::from(format!("{}/.docker/bin", home)),
            PathBuf::from(format!("{}/.orbstack/bin", home)),
            PathBuf::from(format!("{}/.rd/bin", home)),
            PathBuf::from(format!("{}/.local/bin", home)),
        ];

        let docker_candidates = [
            "/usr/local/bin/docker",
            "/opt/homebrew/bin/docker",
            "/usr/bin/docker",
            "docker",
        ];
        for c in &docker_candidates {
            if Path::new(c).exists() {
                return (c.to_string(), extra_dirs);
            }
        }
        ("docker".to_string(), extra_dirs)
    }
}

fn build_process_path(extra_paths: &[PathBuf]) -> std::ffi::OsString {
    let mut current_paths = std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()).collect::<Vec<_>>();
    for p in extra_paths {
        if !current_paths.contains(p) {
            current_paths.insert(0, p.clone());
        }
    }
    std::env::join_paths(current_paths).unwrap_or_default()
}

#[tauri::command]
async fn copy_host_file_to_container(
    container_id: String,
    dest_dir: String,
    host_path: String,
) -> Result<(), String> {
    let host_p = Path::new(&host_path);
    if !host_p.exists() {
        return Err("Host file not found".into());
    }

    let file_name = match host_p.file_name() {
        Some(name) => name.to_string_lossy().to_string(),
        None => "file".to_string(),
    };

    let target_dest = if dest_dir == "/" {
        format!("/{}", file_name)
    } else {
        format!("{}/{}", dest_dir.trim_end_matches('/'), file_name)
    };

    let (docker_bin, extra_dirs) = get_docker_exec_command();
    let full_path = build_process_path(&extra_dirs);

    let output = Command::new(&docker_bin)
        .env("PATH", full_path)
        .args(["cp", &host_path, &format!("{}:{}", container_id, target_dest)])
        .output();

    match output {
        Ok(out) if out.status.success() => Ok(()),
        Ok(out) => {
            let err_msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
            let msg = if !err_msg.is_empty() {
                err_msg
            } else {
                format!("Docker cp exited with code: {:?}", out.status.code())
            };
            Err(msg)
        }
        Err(e) => Err(format!("Failed to run docker cp: {}", e)),
    }
}

#[tauri::command]
async fn copy_file_from_container(
    container_id: String,
    file_path: String,
) -> Result<String, String> {
    let base_name = Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());

    let drag_cache_dir = std::env::temp_dir().join("ilc-drag");
    let _ = std::fs::create_dir_all(&drag_cache_dir);

    let session_dir = drag_cache_dir.join(format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()));
    let _ = std::fs::create_dir_all(&session_dir);

    let dest_file = session_dir.join(&base_name);
    let (docker_bin, extra_dirs) = get_docker_exec_command();
    let full_path = build_process_path(&extra_dirs);

    let output = Command::new(&docker_bin)
        .env("PATH", full_path)
        .args(["cp", &format!("{}:{}", container_id, file_path), &dest_file.to_string_lossy()])
        .output();

    match output {
        Ok(out) if out.status.success() => Ok(dest_file.to_string_lossy().to_string()),
        Ok(out) => {
            let err_msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
            Err(if !err_msg.is_empty() { err_msg } else { format!("Failed with code {:?}", out.status.code()) })
        }
        Err(e) => Err(format!("Failed to run docker cp: {}", e)),
    }
}

#[tauri::command]
async fn read_host_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    std::fs::read_to_string(p).map_err(|e| e.to_string())
}

#[tauri::command]
async fn prepare_container_drag_files(
    container_id: String,
    file_paths: Vec<String>,
) -> Result<Vec<String>, String> {
    let drag_cache_dir = std::env::temp_dir().join("ilc-drag");
    let _ = std::fs::create_dir_all(&drag_cache_dir);

    let session_dir = drag_cache_dir.join(format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()));
    let _ = std::fs::create_dir_all(&session_dir);

    let (docker_bin, extra_dirs) = get_docker_exec_command();
    let full_path = build_process_path(&extra_dirs);

    let mut result_paths = Vec::new();

    for file_path in file_paths {
        let base_name = Path::new(&file_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "file".to_string());

        let dest_file = session_dir.join(&base_name);

        let output = Command::new(&docker_bin)
            .env("PATH", &full_path)
            .args(["cp", &format!("{}:{}", container_id, file_path), &dest_file.to_string_lossy()])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                result_paths.push(dest_file.to_string_lossy().to_string());
            }
            Ok(out) => {
                let err_msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
                return Err(if !err_msg.is_empty() { err_msg } else { format!("Failed to copy file: {:?}", file_path) });
            }
            Err(e) => return Err(format!("Failed to run docker cp: {}", e)),
        }
    }

    Ok(result_paths)
}

#[tauri::command]
fn detect_container_engines() -> Vec<NativeEngineInfo> {
    let mut engines = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let docker_app = format!("{}\\Docker\\Docker\\Docker Desktop.exe", program_files);
        let docker_app_alt = format!("{}\\Programs\\Docker\\Docker\\Docker Desktop.exe", local_app_data);
        let docker_app_exists = Path::new(&docker_app).exists() || (!local_app_data.is_empty() && Path::new(&docker_app_alt).exists());
        let docker_pipe = "//./pipe/docker_engine".to_string();

        engines.push(NativeEngineInfo {
            id: "docker-desktop".into(),
            name: "Docker Desktop".into(),
            socket_path: docker_pipe,
            app_path: if docker_app_exists { Some(docker_app) } else { None },
            status: if docker_app_exists { "running".into() } else { "not_installed".into() },
            is_default: true,
        });

        let podman_app = format!("{}\\RedHat\\Podman\\podman.exe", program_files);
        let podman_app_exists = Path::new(&podman_app).exists();
        engines.push(NativeEngineInfo {
            id: "podman".into(),
            name: "Podman".into(),
            socket_path: "//./pipe/podman-machine-default".into(),
            app_path: if podman_app_exists { Some(podman_app) } else { None },
            status: if podman_app_exists { "running".into() } else { "not_installed".into() },
            is_default: false,
        });

        let rancher_app = format!("{}\\Programs\\Rancher Desktop\\Rancher Desktop.exe", local_app_data);
        let rancher_app_exists = !local_app_data.is_empty() && Path::new(&rancher_app).exists();
        engines.push(NativeEngineInfo {
            id: "rancher".into(),
            name: "Rancher Desktop".into(),
            socket_path: "//./pipe/rancher_desktop".into(),
            app_path: if rancher_app_exists { Some(rancher_app) } else { None },
            status: if rancher_app_exists { "running".into() } else { "not_installed".into() },
            is_default: false,
        });
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let docker_socket = "/var/run/docker.sock".to_string();
        let docker_exists = Path::new(&docker_socket).exists();
        engines.push(NativeEngineInfo {
            id: "docker-desktop".into(),
            name: "Docker Engine".into(),
            socket_path: docker_socket,
            app_path: if Path::new("/usr/bin/docker").exists() { Some("/usr/bin/docker".into()) } else { None },
            status: if docker_exists { "running".into() } else { "stopped".into() },
            is_default: true,
        });

        let uid = unsafe { libc::getuid() };
        let podman_user_sock = format!("/run/user/{}/podman/podman.sock", uid);
        let podman_sys_sock = "/var/run/podman/podman.sock".to_string();
        let podman_sock = if Path::new(&podman_user_sock).exists() {
            podman_user_sock
        } else {
            podman_sys_sock
        };
        let podman_exists = Path::new(&podman_sock).exists();
        engines.push(NativeEngineInfo {
            id: "podman".into(),
            name: "Podman".into(),
            socket_path: podman_sock,
            app_path: if Path::new("/usr/bin/podman").exists() { Some("/usr/bin/podman".into()) } else { None },
            status: if podman_exists { "running".into() } else { "not_installed".into() },
            is_default: false,
        });

        let rd_socket = format!("{}/.rd/docker.sock", home);
        let rd_exists = Path::new(&rd_socket).exists();
        engines.push(NativeEngineInfo {
            id: "rancher".into(),
            name: "Rancher Desktop".into(),
            socket_path: rd_socket,
            app_path: None,
            status: if rd_exists { "running".into() } else { "not_installed".into() },
            is_default: false,
        });
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users".to_string());

        let docker_socket = format!("{}/.docker/run/docker.sock", home);
        let docker_app = "/Applications/Docker.app";
        let docker_app_exists = Path::new(docker_app).exists();
        let docker_socket_exists = Path::new(&docker_socket).exists() || (docker_app_exists && Path::new("/var/run/docker.sock").exists());
        let docker_status = if docker_app_exists && docker_socket_exists {
            "running"
        } else if docker_app_exists {
            "stopped"
        } else {
            "not_installed"
        };
        engines.push(NativeEngineInfo {
            id: "docker-desktop".into(),
            name: "Docker Desktop".into(),
            socket_path: if Path::new(&docker_socket).exists() { docker_socket } else { "/var/run/docker.sock".into() },
            app_path: if docker_app_exists { Some(docker_app.into()) } else { None },
            status: docker_status.into(),
            is_default: true,
        });

        let orb_socket = format!("{}/.orbstack/run/docker.sock", home);
        let orb_app = "/Applications/OrbStack.app";
        let orb_socket_exists = Path::new(&orb_socket).exists();
        let orb_app_exists = Path::new(orb_app).exists();
        let orb_status = if orb_socket_exists {
            "running"
        } else if orb_app_exists {
            "stopped"
        } else {
            "not_installed"
        };
        engines.push(NativeEngineInfo {
            id: "orbstack".into(),
            name: "OrbStack".into(),
            socket_path: orb_socket,
            app_path: if orb_app_exists { Some(orb_app.into()) } else { None },
            status: orb_status.into(),
            is_default: false,
        });

        let rancher_socket = format!("{}/.rd/docker.sock", home);
        let rancher_socket_v2 = format!("{}/.rd2/docker.sock", home);
        let rancher_app = "/Applications/Rancher Desktop.app";
        let rancher_config = format!("{}/.rd", home);
        let rancher_config_v2 = format!("{}/.rd2", home);
        let rancher_socket_exists = Path::new(&rancher_socket).exists();
        let rancher_socket_v2_exists = Path::new(&rancher_socket_v2).exists();
        let rancher_app_exists = Path::new(rancher_app).exists();
        let rancher_config_exists = Path::new(&rancher_config).exists();
        let rancher_config_v2_exists = Path::new(&rancher_config_v2).exists();
        let resolved_rancher_socket = if rancher_socket_exists {
            rancher_socket.clone()
        } else if rancher_socket_v2_exists {
            rancher_socket_v2.clone()
        } else {
            rancher_socket.clone()
        };
        let rancher_status = if rancher_socket_exists || rancher_socket_v2_exists {
            "running"
        } else if rancher_app_exists || rancher_config_exists || rancher_config_v2_exists {
            "stopped"
        } else {
            "not_installed"
        };
        engines.push(NativeEngineInfo {
            id: "rancher".into(),
            name: "Rancher Desktop".into(),
            socket_path: resolved_rancher_socket,
            app_path: if rancher_app_exists { Some(rancher_app.into()) } else { None },
            status: rancher_status.into(),
            is_default: false,
        });

        let colima_socket = format!("{}/.colima/default/docker.sock", home);
        let colima_exists = Path::new(&colima_socket).exists();
        engines.push(NativeEngineInfo {
            id: "colima".into(),
            name: "Colima".into(),
            socket_path: colima_socket,
            app_path: None,
            status: if colima_exists { "running".into() } else { "not_installed".into() },
            is_default: false,
        });

        let podman_socket = format!("{}/.local/share/containers/podman/machine/podman-machine-default/podman.sock", home);
        let podman_app = "/Applications/Podman Desktop.app";
        let podman_socket_exists = Path::new(&podman_socket).exists();
        let podman_app_exists = Path::new(podman_app).exists();
        let podman_status = if podman_socket_exists {
            "running"
        } else if podman_app_exists {
            "stopped"
        } else {
            "not_installed"
        };
        engines.push(NativeEngineInfo {
            id: "podman".into(),
            name: "Podman".into(),
            socket_path: podman_socket,
            app_path: if podman_app_exists { Some(podman_app.into()) } else { None },
            status: podman_status.into(),
            is_default: false,
        });
    }

    engines
}

fn find_node_binary() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("where.exe").arg("node").output() {
            if output.status.success() {
                let lines = String::from_utf8_lossy(&output.stdout);
                for line in lines.lines() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() && Path::new(trimmed).exists() {
                        return Some(PathBuf::from(trimmed));
                    }
                }
            }
        }

        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let app_data = std::env::var("APPDATA").unwrap_or_default();
        let candidates = [
            format!("{}\\nodejs\\node.exe", program_files),
            format!("{}\\Programs\\nodejs\\node.exe", local_app_data),
            format!("{}\\nvm\\nodejs\\node.exe", app_data),
        ];
        for c in &candidates {
            let p = Path::new(c);
            if p.is_file() && p.exists() {
                return Some(p.to_path_buf());
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = Command::new("which").arg("node").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() && Path::new(&path_str).exists() {
                    return Some(PathBuf::from(path_str));
                }
            }
        }

        for shell in &["/bin/zsh", "/bin/bash", "/bin/sh"] {
            if Path::new(shell).exists() {
                if let Ok(output) = Command::new(shell).args(["-lic", "which node"]).output() {
                    if output.status.success() {
                        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        if !path_str.is_empty() && Path::new(&path_str).exists() {
                            return Some(PathBuf::from(path_str));
                        }
                    }
                }
            }
        }

        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let nvm_dir = Path::new(&home).join(".nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(nvm_dir) {
            let mut versions: Vec<PathBuf> = entries
                .filter_map(|e| e.ok())
                .map(|e| e.path().join("bin/node"))
                .filter(|p| p.is_file() && p.exists())
                .collect();
            versions.sort();
            if let Some(node_path) = versions.pop() {
                return Some(node_path);
            }
        }

        let custom_paths = [
            format!("{}/.fnm/current/bin/node", home),
            format!("{}/.local/share/fnm/current/bin/node", home),
            format!("{}/.volta/bin/node", home),
            format!("{}/.asdf/shims/node", home),
            format!("{}/.n/bin/node", home),
        ];
        for p_str in &custom_paths {
            let p = Path::new(p_str);
            if p.is_file() && p.exists() {
                return Some(p.to_path_buf());
            }
        }

        let candidates = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/opt/local/bin/node",
        ];
        for c in &candidates {
            let p = Path::new(c);
            if p.is_file() && p.exists() {
                return Some(p.to_path_buf());
            }
        }
    }

    None
}

fn find_server_script(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(res_dir) = app.path().resource_dir() {
        let candidates = [
            res_dir.join("server.mjs"),
            res_dir.join("resources/server.mjs"),
            res_dir.join("_up_/server.mjs"),
        ];
        for c in &candidates {
            if c.exists() {
                return Some(c.clone());
            }
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let candidates = [
                exe_dir.join("server.mjs"),
                exe_dir.join("resources/server.mjs"),
                exe_dir.join("../Resources/server.mjs"),
            ];
            for c in &candidates {
                if c.exists() {
                    return Some(c.clone());
                }
            }
        }
    }

    let cwd_candidates = [
        PathBuf::from("server.mjs"),
        PathBuf::from("src-tauri/server.mjs"),
        PathBuf::from("../src-tauri/server.mjs"),
    ];
    for c in &cwd_candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }

    None
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_drag::init())
        .manage(BackgroundServer(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_native_window,
            open_external_url,
            detect_container_engines,
            broadcast_theme_settings,
            check_fullscreen,
            drag_window,
            copy_host_file_to_container,
            copy_file_from_container,
            prepare_container_drag_files,
            read_host_text_file
        ])

        .setup(|app| {
            let app_handle = app.handle().clone();
            let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_else(|_| ".".to_string());
            if let Some(node_bin) = find_node_binary() {
                if let Some(script) = find_server_script(&app_handle) {
                    println!("[Tauri] Starting background server with {:?} and {:?}", node_bin, script);
                    
                    let node_dir = node_bin.parent().map(|p| p.to_path_buf()).unwrap_or_default();
                    let (_, mut extra_dirs) = get_docker_exec_command();
                    extra_dirs.insert(0, node_dir);
                    let full_path = build_process_path(&extra_dirs);

                    let mut cmd = Command::new(&node_bin);
                    cmd.arg(&script)
                        .current_dir(&home)
                        .env("PATH", &full_path)
                        .stdin(Stdio::null());

                    let log_path = std::env::temp_dir().join("ilc-server.log");
                    if let Ok(log_file) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path) {
                        if let Ok(err_file) = log_file.try_clone() {
                            cmd.stdout(Stdio::from(log_file));
                            cmd.stderr(Stdio::from(err_file));
                        } else {
                            cmd.stdout(Stdio::null());
                            cmd.stderr(Stdio::null());
                        }
                    } else {
                        cmd.stdout(Stdio::null());
                        cmd.stderr(Stdio::null());
                    }

                    match cmd.spawn() {
                        Ok(child) => {
                            if let Some(server_state) = app.try_state::<BackgroundServer>() {
                                if let Ok(mut lock) = server_state.0.lock() {
                                    *lock = Some(child);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[Tauri] Failed to spawn background server: {}", e);
                        }
                    }
                } else {
                    eprintln!("[Tauri] server.mjs not found");
                }
            } else {
                eprintln!("[Tauri] node binary not found");
            }

            if let Some(_main_win) = app.get_webview_window("main") {
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = _main_win.set_decorations(true);
                }
            }

            #[cfg(target_os = "macos")]
            {
                if let Ok(menu) = tauri::menu::Menu::default(app.handle()) {
                    let _ = app.set_menu(menu);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized(size) = event {
                let mut is_fs = window.is_fullscreen().unwrap_or(false);
                if is_fs {
                    if let Ok(Some(monitor)) = window.current_monitor() {
                        let mon_size = monitor.size();
                        if size.width < mon_size.width.saturating_sub(20) || size.height < mon_size.height.saturating_sub(100) {
                            is_fs = false;
                        }
                    }
                }
                let _ = window.emit("fullscreen-changed", is_fs);
            }
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    if let Some(server_state) = window.app_handle().try_state::<BackgroundServer>() {
                        if let Ok(mut lock) = server_state.0.lock() {
                            if let Some(mut child) = lock.take() {
                                let _ = child.kill();
                            }
                        }
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(server_state) = app_handle.try_state::<BackgroundServer>() {
                if let Ok(mut lock) = server_state.0.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}
