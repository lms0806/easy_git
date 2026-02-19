<<<<<<< HEAD
<<<<<<< HEAD
# Easy Git

Git을 더 쉽게 다루기 위한 Windows 데스크톱 앱입니다. (Tauri + React)

## 기능

- **GitHub 로그인**: 브라우저에서 GitHub OAuth로 로그인
- **왼쪽 패널**: 로그인한 계정의 레포지토리 목록
- **가운데 패널**: 선택한 레포의 커밋 이력
- **오른쪽 패널**: 선택한 커밋에서 변경된 파일 목록 (추가/수정/삭제/이름변경 표시)

## 실행 방법

### 1. GitHub OAuth 앱 등록 (최초 1회)

1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) 에서 **New OAuth App** 클릭
2. **Application name**: `Easy Git` (원하는 이름)
3. **Homepage URL**: `http://127.0.0.1` (사실상 미사용)
4. **Authorization callback URL**: **`http://127.0.0.1:9418/callback`** 로 정확히 입력
5. **Register application** 후 **Client ID** 와 **Client secrets** 에서 **Generate a new client secret** 로 시크릿 발급

### 2. 환경 변수 설정

앱이 OAuth 로그인을 하려면 Client ID와 Client Secret이 필요합니다. 아래 중 하나로 설정하세요.

- **방법 A (권장)**  
  터미널에서 한 번만 설정 후 실행:
  ```powershell
  $env:EASY_GIT_OAUTH_CLIENT_ID = "여기에_Client_ID"
  $env:EASY_GIT_OAUTH_CLIENT_SECRET = "여기에_Client_Secret"
  npm run tauri dev
  ```
- **방법 B**  
  `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` 환경 변수에 같은 값 설정

### 3. 앱 실행

```bash
npm install
npm run tauri dev
```

로그인 화면에서 **GitHub로 로그인** 버튼을 누르면 브라우저가 열리고, GitHub에서 권한을 승인하면 앱으로 돌아와 로그인됩니다.

## 빌드 (Windows 실행 파일)

```bash
npm run tauri build
```

생성된 실행 파일은 `src-tauri/target/release/` 에 있습니다.  
배포 시 사용하는 환경에서도 위 OAuth 환경 변수를 설정해 두어야 로그인이 동작합니다.
=======
# easy_git
>>>>>>> 70254aee85792fcdbe909cd45c7f7c3f5e0b8637
=======
# easy_git
>>>>>>> dc0567c4be136e8868b28daec62f334b3f7b23fc
