# inflearn-mcp

인프런 공개 커뮤니티 질문을 MCP로 조회할 수 있게 만든 서버입니다.

이 프로젝트로 할 수 있는 일:

- 닉네임, 제목, 키워드로 질문 검색
- 인프런 인기 글 조회
- MCP 클라이언트에서 인프런 질문 데이터를 바로 호출

현재 제공하는 도구:

- `healthcheck()`
- `search_questions(keyword, page=1)`
- `get_trending_questions(date, limit=5, type="all")`
- `get_question(url)`  
  현재는 상세 파싱이 아직 구현되지 않아 placeholder 응답만 반환합니다.

## 사용 방법

### 1. 설치

```bash
pnpm install
```

### 2. 로컬 실행

```bash
pnpm dev
```

로컬 MCP 주소 예시:

```text
http://127.0.0.1:8787/mcp
```

### 3. 타입 체크

```bash
pnpm check
```

## Claude Code에서 연결하기

CLI로 추가:

```bash
claude mcp add --transport http inflearn-local http://127.0.0.1:8787/mcp
```

프로젝트의 `.mcp.json`으로 추가:

```json
{
  "mcpServers": {
    "inflearn-local": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp"
    }
  }
}
```

## Codex에서 연결하기

CLI로 추가:

```bash
codex mcp add inflearn-local http://127.0.0.1:8787/mcp
```

`~/.codex/config.toml`에 직접 추가:

```toml
[mcp_servers.inflearn-local]
url = "http://127.0.0.1:8787/mcp"
```

## 예시

작성자 검색:

```text
search_questions(keyword="withkey", page=1)
```

인기 글 조회:

```text
get_trending_questions(date="2026-03-25", limit=10, type="all")
```

## 참고

- 공개 접근 가능한 인프런 커뮤니티 데이터만 대상으로 합니다.
- 핵심 구현은 [src/index.ts](/Users/devkey/Documents/inflearn-mcp/src/index.ts)에 있습니다.
