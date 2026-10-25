#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt};

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let (mut rx, child) = app.shell().sidecar("aklik-engine")?.args(["--sidecar", "--headless"]).spawn()?;
            app.manage(Mutex::new(Some(child)));
            let handle = app.handle().clone();
            let watchdog = handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(30));
                if watchdog.get_webview_window("main").is_none() { watchdog.exit(1); }
            });
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let text = String::from_utf8_lossy(&line);
                            if let Some(address) = text.strip_prefix("AKLIK_READY ") {
                                let address = address.trim();
                                if address != "http://127.0.0.1:43110" { handle.exit(1); break; }
                                let window = tauri::WebviewWindowBuilder::new(&handle, "main", tauri::WebviewUrl::External(address.parse().unwrap()))
                                    .title("aKlik-Deployer").inner_size(1360.0, 900.0).min_inner_size(380.0, 600.0).build();
                                if window.is_err() { handle.exit(1); }
                                break;
                            }
                        }
                        CommandEvent::Terminated(_) | CommandEvent::Error(_) => { handle.exit(1); break; }
                        _ => {}
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("aKlik-Deployer konnte nicht gestartet werden");
    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = handle.try_state::<Mutex<Option<CommandChild>>>() {
                if let Ok(mut child) = state.lock() { if let Some(child) = child.take() { let _ = child.kill(); } }
            }
        }
    });
}
