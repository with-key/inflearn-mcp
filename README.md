# inflearn-mcp

인프런 공개 커뮤니티 질문을 MCP로 조회할 수 있는 서버입니다.  
사용자는 이 저장소를 직접 실행할 필요 없이, 배포된 MCP 서버 URL만 있으면 `Claude Code`나 `Codex`에 연결해서 바로 사용할 수 있습니다.

## 할 수 있는 일

- 닉네임, 제목, 키워드로 질문 검색
- 인프런 인기 글 조회
- MCP 클라이언트 안에서 인프런 질문 데이터를 바로 호출

현재 제공하는 도구:

- `healthcheck()`
- `search_questions(keyword, page=1)`
- `get_trending_questions(date, limit=5, type="all")`
- `get_question(url)`  
  현재는 상세 파싱이 아직 구현되지 않아 placeholder 응답만 반환합니다.

## 연결 방법

```text
https://inflearn-mcp.devkey.workers.dev/mcp
```

## Claude Code에서 사용하기

CLI로 추가:

```bash
claude mcp add --transport http inflearn https://inflearn-mcp.devkey.workers.dev/mcp
```

프로젝트의 `.mcp.json`으로 추가:

```json
{
  "mcpServers": {
    "inflearn": {
      "type": "http",
      "url": "https://inflearn-mcp.devkey.workers.dev/mcp"
    }
  }
}
```

## Codex에서 사용하기

CLI로 추가:

```bash
codex mcp add inflearn https://inflearn-mcp.devkey.workers.dev/mcp
```

`~/.codex/config.toml`에 직접 추가:

```toml
[mcp_servers.inflearn]
url = "https://inflearn-mcp.devkey.workers.dev/mcp"
```

## 사용 예시

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
