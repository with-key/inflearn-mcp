# inflearn-mcp

인프런 공개 커뮤니티 질문을 MCP로 조회할 수 있는 서버입니다.
`Claude Code`나 `Codex`에 연결해서 바로 사용할 수 있습니다.

## 제공 도구

| 도구 | 설명 | 파라미터 |
|------|------|----------|
| `healthcheck` | 서버 상태 확인 | 없음 |
| `search_questions` | 키워드로 질문 검색 | `keyword` (필수), `page` (기본값: 1), `order` (정렬: recent/score/comment/recommend, 기본값: recent), `status` (상태: resolved/unresolved/빈문자열, 기본값: 전체), `tags` (태그 필터: string[], 기본값: []) |
| `get_trending_questions` | 인기 커뮤니티 글 조회 | `date` (기본값: 오늘), `limit` (1~20, 기본값: 5), `type` (기본값: "all") |

## 연결 방법

### Claude Code에서 사용하기

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

### Codex에서 사용하기

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

```text
"인프런에서 React 관련 질문 검색해줘"
"인프런 커뮤니티에서 아직 미해결인 JavaScript 질문 찾아줘"
"인프런에서 좋아요 많은 순으로 Spring Boot 질문 보여줘"
"인프런에서 docker 태그가 달린 질문 중 해결된 것만 보여줘"
"이번 주 인프런 인기 게시글 5개 알려줘"
"인프런 mcp 사용해서 withkey가 작성한 글 모두 보여줘"
```

## 참고

- 공개 접근 가능한 인프런 커뮤니티 데이터만 대상으로 합니다.
- "인프런"과 무관한 커뮤니티 프로젝트 입니다.
- 사전 고지없이 프로젝트가 중단 될 수 있습니다.
