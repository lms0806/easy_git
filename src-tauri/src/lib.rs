// Access Token은 프론트에서 입력받아 GitHub API 호출에 사용합니다.
// 백엔드에서는 별도 OAuth/환경 변수 없이 동작합니다.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
