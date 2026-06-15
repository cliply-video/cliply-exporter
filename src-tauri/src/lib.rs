mod binaries;

use tauri_plugin_sql::{Migration, MigrationKind};

pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "local clip-cutter schema",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:cliply-oss.db", migrations)
                .build(),
        )
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("cliply-oss".into()),
                    }),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            binaries::binaries_status,
            binaries::download_binaries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
