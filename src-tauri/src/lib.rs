// GitHub OAuth 로그인 (웹 플로우: 브라우저에서 승인 후 로컬 콜백으로 토큰 수신)

use rand::Rng;
use serde::Deserialize;
use std::io::{Read, Write};
use std::net::TcpListener;

const REDIRECT_PORT: u16 = 9418;
const GITHUB_AUTHORIZE: &str = "https://github.com/login/oauth/authorize";
const GITHUB_ACCESS_TOKEN: &str = "https://github.com/login/oauth/access_token";

fn random_state() -> String {
    let mut buf = [0u8; 16];
    rand::thread_rng().fill(&mut buf[..]);
    hex::encode(buf)
}

/// 로컬 서버에서 한 번의 GET 요청을 받아 query string 반환
fn wait_for_callback(listener: TcpListener, auth_url: &str) -> Result<String, String> {
    if webbrowser::open(auth_url).is_err() {
        // 브라우저 열기 실패해도 서버는 대기 (사용자가 직접 URL 열 수 있음)
    }

    let (mut stream, _) = listener
        .accept()
        .map_err(|e| format!("콜백 수신 실패: {}", e))?;

    let mut buf = [0u8; 4096];
    let n = stream
        .read(&mut buf)
        .map_err(|e| format!("요청 읽기 실패: {}", e))?;
    let request = String::from_utf8_lossy(&buf[..n]);

    // GET /callback?code=...&state=... HTTP/1.1
    let query = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|path| path.find('?').map(|i| &path[i + 1..]))
        .unwrap_or("")
        .to_string();

    let html = r#"<!DOCTYPE html><html><head><meta charset="utf-8"><title>Easy Git</title></head><body><p>로그인 성공했습니다. 이 창을 닫아 주세요.</p></body></html>"#;
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    Ok(query)
}

fn parse_query(query: &str) -> Option<(String, String)> {
    let mut code = None;
    let mut state = None;
    for part in query.split('&') {
        let (k, v) = part.split_once('=')?;
        let v = urlencoding::decode(v).ok()?;
        match k {
            "code" => code = Some(v.into_owned()),
            "state" => state = Some(v.into_owned()),
            _ => {}
        }
    }
    Some((code?, state?))
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

#[tauri::command]
async fn github_oauth_login() -> Result<String, String> {
    let client_id = std::env::var("EASY_GIT_OAUTH_CLIENT_ID")
        .or_else(|_| std::env::var("GITHUB_OAUTH_CLIENT_ID"))
        .map_err(|_| {
            "OAuth Client ID가 없습니다. 환경 변수 EASY_GIT_OAUTH_CLIENT_ID 또는 GITHUB_OAUTH_CLIENT_ID 를 설정하세요.".to_string()
        })?;
    let client_secret = std::env::var("EASY_GIT_OAUTH_CLIENT_SECRET")
        .or_else(|_| std::env::var("GITHUB_OAUTH_CLIENT_SECRET"))
        .map_err(|_| {
            "OAuth Client Secret이 없습니다. 환경 변수 EASY_GIT_OAUTH_CLIENT_SECRET 또는 GITHUB_OAUTH_CLIENT_SECRET 를 설정하세요.".to_string()
        })?;

    let state = random_state();
    let redirect_uri = format!("http://127.0.0.1:{}/callback", REDIRECT_PORT);
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&scope=repo&state={}",
        GITHUB_AUTHORIZE,
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&state)
    );

    let listener = TcpListener::bind(format!("127.0.0.1:{}", REDIRECT_PORT))
        .map_err(|e| format!("로컬 서버 시작 실패 (포트 {}): {}", REDIRECT_PORT, e))?;

    let query = tauri::async_runtime::spawn_blocking(move || wait_for_callback(listener, &auth_url))
        .await
        .map_err(|e| e.to_string())??;
    let (code, returned_state) =
        parse_query(&query).ok_or_else(|| "콜백에서 code/state를 찾을 수 없습니다.".to_string())?;

    if returned_state != state {
        return Err("state 불일치. 재시도해 주세요.".to_string());
    }

    let client = reqwest::Client::new();
    let res = client
        .post(GITHUB_ACCESS_TOKEN)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("code", &code),
            ("redirect_uri", &redirect_uri),
        ])
        .send()
        .await
        .map_err(|e| format!("토큰 요청 실패: {}", e))?;

    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("GitHub 토큰 응답 오류: {}", text));
    }

    let token_res: TokenResponse = res
        .json()
        .await
        .map_err(|e| format!("토큰 응답 파싱 실패: {}", e))?;

    Ok(token_res.access_token)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![github_oauth_login])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
