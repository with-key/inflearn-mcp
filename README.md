# inflearn-mcp

인프런 공개 커뮤니티 질문을 MCP로 조회할 수 있는 서버입니다.
배포된 MCP 서버 URL만 있으면 `Claude Code`나 `Codex`에 연결해서 바로 사용할 수 있습니다.

## 제공 도구

| 도구 | 설명 | 파라미터 |
|------|------|----------|
| `healthcheck` | 서버 상태 확인 | 없음 |
| `search_questions` | 키워드로 질문 검색 | `keyword` (필수), `page` (기본값: 1) |
| `get_trending_questions` | 인기 커뮤니티 글 조회 | `date` (기본값: 오늘), `limit` (1~20, 기본값: 5), `type` (기본값: "all") |
| `get_question` | 질문 상세 조회 | `url` |

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

키워드로 질문 검색:

```text
search_questions(keyword="withkey", page=1)
```

인기 글 조회:

```text
get_trending_questions(date="2026-03-25", limit=10, type="all")
```

## 참고

- 공개 접근 가능한 인프런 커뮤니티 데이터만 대상으로 합니다.
