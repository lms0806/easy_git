# Easy Git

Git을 더 쉽게 다루기 위한 Windows 데스크톱 앱입니다. (Tauri + React)

## 기능

- **GitHub 로그인**: Personal Access Token만 입력해 로그인
- **왼쪽 패널**: 로그인한 계정의 레포지토리 목록
- **가운데 패널**: 선택한 레포의 커밋 이력
- **오른쪽 패널**: 선택한 커밋에서 변경된 파일 목록 (추가/수정/삭제/이름변경 표시)

## 실행 방법

### 1. GitHub Personal Access Token 발급 (최초 1회)

1. [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) 에서 **Generate new token** (Classic) 선택
2. **Note**: `Easy Git` 등 원하는 이름
3. **Expiration**: 원하는 기간
4. **Scopes**: **repo** 권한 체크
5. **Generate token** 후 표시되는 토큰을 복사 (한 번만 표시되므로 안전한 곳에 보관)

### 2. 앱 실행

```bash
npm install
npm run tauri dev
```

로그인 화면에서 위에서 발급한 **Access Token**을 붙여 넣고 **로그인** 버튼을 누르면 됩니다. 토큰은 로컬에 저장되어 다음 실행 시 자동으로 로그인됩니다.

## 빌드 (Windows 실행 파일)

```bash
npm run tauri build
```

생성된 실행 파일은 `src-tauri/target/release/` 에 있습니다.
