import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

type Bindings = {
  INFLEARN_BASE_URL?: string;
  INFLEARN_API_BASE_URL?: string;
  INFLEARN_RANK_API_BASE_URL?: string;
  MCP_SERVER_NAME?: string;
  MCP_SERVER_VERSION?: string;
};

type ApiQuestionRecord = Record<string, unknown>;

type SearchResult = {
  id: string;
  url: string;
  title: string | null;
  status: string | null;
  summary: string | null;
  author: string | null;
  relativeTime: string | null;
  courseTitle: string | null;
  tags: string[];
  likeCount: number | null;
  viewCount: number | null;
  answerCount: number | null;
};

const asString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const firstString = (record: ApiQuestionRecord, keys: string[]): string | null => {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
};

const firstNumber = (record: ApiQuestionRecord, keys: string[]): number | null => {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
};

const firstArray = (record: ApiQuestionRecord, keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const normalizeQuestionRecord = (record: ApiQuestionRecord, baseUrl: string): SearchResult => {
  const id = firstString(record, ['id', 'postId', 'communityPostId']) ?? '';
  const slug = firstString(record, ['slug', 'urlSlug']);
  const urlPath =
    firstString(record, ['url', 'path', 'postUrl']) ??
    (id ? `/community/questions/${id}${slug ? `/${slug}` : ''}` : '/community/questions');
  const tagValues = firstArray(record, ['tags', 'tagList', 'skillTags']).map((tag) => {
    if (typeof tag === 'string') return tag;
    if (tag && typeof tag === 'object') {
      const tagRecord = tag as Record<string, unknown>;
      return (
        asString(tagRecord.name) ??
        asString(tagRecord.title) ??
        asString(tagRecord.tagName) ??
        asString(tagRecord.value) ??
        ''
      );
    }
    return '';
  });

  return {
    id,
    url: new URL(urlPath, baseUrl).toString(),
    title: firstString(record, ['title', 'questionTitle', 'subject']),
    status: firstString(record, ['status', 'statusLabel', 'questionStatus']),
    summary: firstString(record, ['summary', 'contentSummary', 'body', 'description', 'excerpt']),
    author: firstString(record, ['author', 'authorName', 'nickname', 'username', 'writerName', 'name']),
    relativeTime: firstString(record, ['relativeTime', 'createdAtLabel', 'createdDateText', 'createdAt']),
    courseTitle: firstString(record, ['courseTitle', 'courseName', 'course', 'lectureTitle']),
    tags: tagValues.filter(Boolean),
    likeCount: firstNumber(record, ['likeCount', 'likes', 'voteCount', 'thumbsUpCount']),
    viewCount: firstNumber(record, ['viewCount', 'views', 'hitCount']),
    answerCount: firstNumber(record, ['answerCount', 'commentCount', 'answers', 'replyCount']),
  };
};

const extractQuestionRecords = (payload: unknown): ApiQuestionRecord[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiQuestionRecord => !!item && typeof item === "object");
  }
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.data,
    record.items,
    record.results,
    record.posts,
    record.questions,
    record.content,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiQuestionRecord => !!item && typeof item === 'object');
    }
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      const nestedArrays = [nested.items, nested.results, nested.posts, nested.questions, nested.content];
      for (const nestedCandidate of nestedArrays) {
        if (Array.isArray(nestedCandidate)) {
          return nestedCandidate.filter((item): item is ApiQuestionRecord => !!item && typeof item === 'object');
        }
      }
    }
  }

  return [];
};

const getConfig = (bindings?: Bindings) => ({
  serverName: bindings?.MCP_SERVER_NAME?.trim() || 'inflearn-mcp',
  serverVersion: bindings?.MCP_SERVER_VERSION?.trim() || '0.1.0',
  baseUrl: bindings?.INFLEARN_BASE_URL?.trim() || 'https://www.inflearn.com/community/questions',
  apiBaseUrl:
    bindings?.INFLEARN_API_BASE_URL?.trim() || 'https://www.inflearn.com/api/community-posts/question',
  rankApiBaseUrl:
    bindings?.INFLEARN_RANK_API_BASE_URL?.trim() || 'https://www.inflearn.com/api/v1/community/rank/post',
});

const fetchJson = async (url: string, bindings?: Bindings) => {
  const { serverName, serverVersion } = getConfig(bindings);
  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'user-agent': `${serverName}/${serverVersion} (+cloudflare-worker)`,
    },
  });

  if (!response.ok) {
    throw new Error(`Inflearn request failed with status ${response.status}`);
  }

  return (await response.json()) as unknown;
};

const fetchSearchResults = async (keyword: string | undefined, page: number, bindings?: Bindings) => {
  const { baseUrl, apiBaseUrl } = getConfig(bindings);
  const searchUrl = new URL(apiBaseUrl);
  searchUrl.searchParams.set('status', '');
  if (keyword && keyword.trim()) {
    searchUrl.searchParams.set('s', keyword);
  } else {
    searchUrl.searchParams.set('s', '');
  }
  searchUrl.searchParams.set('tag', '');
  searchUrl.searchParams.set('order', 'recent');
  searchUrl.searchParams.set('page', String(page));
  const payload = await fetchJson(searchUrl.toString(), bindings);
  const records = extractQuestionRecords(payload);
  const results = records.map((record) => normalizeQuestionRecord(record, baseUrl));

  return {
    searchUrl: searchUrl.toString(),
    payload,
    results,
  };
};

const fetchTrendingQuestions = async (date: string, limit: number, type: string, bindings?: Bindings) => {
  const { baseUrl, rankApiBaseUrl } = getConfig(bindings);
  const rankUrl = new URL(rankApiBaseUrl);
  rankUrl.searchParams.set('date', date);
  rankUrl.searchParams.set('limit', String(limit));
  rankUrl.searchParams.set('type', type);
  rankUrl.searchParams.set('usedBy', 'gnb');

  const payload = await fetchJson(rankUrl.toString(), bindings);
  const records = extractQuestionRecords(payload);
  const results = records.map((record) => normalizeQuestionRecord(record, baseUrl));

  return {
    rankUrl: rankUrl.toString(),
    payload,
    results,
  };
};

const createServer = (bindings?: Bindings) => {
  const { serverName, serverVersion } = getConfig(bindings);
  const server = new McpServer({
    name: serverName,
    version: serverVersion,
  });

  server.registerTool(
    'healthcheck',
    {
      title: 'Healthcheck',
      description: 'Return basic server status.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'ok',
              server: serverName,
              version: serverVersion,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        status: 'ok',
        server: serverName,
        version: serverVersion,
      },
    })
  );

  server.registerTool(
    'search_questions',
    {
      title: 'Search Inflearn Questions',
      description: 'Search public Inflearn question pages by keyword, title, tag, or author.',
      inputSchema: z.object({
        keyword: z.string().min(1),
        page: z.number().int().min(1).default(1),
      }),
    },
    async ({ keyword, page = 1 }: { keyword: string; page?: number }) => {
      const { searchUrl, results } = await fetchSearchResults(keyword, page, bindings);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                keyword,
                page,
                url: searchUrl,
                result_count: results.length,
                results,
              },
              null,
              2
            ),
          },
        ],
        structuredContent: {
          keyword,
          page,
          url: searchUrl,
          result_count: results.length,
          results,
        },
      };
    }
  );

  server.registerTool(
    'get_trending_posts',
    {
      title: 'Get Trending Inflearn Posts',
      description: 'Get weekly popular community posts from Inflearn rank API.',
      inputSchema: z.object({
        date: z.string().min(10).default(new Date().toISOString().slice(0, 10)),
        limit: z.number().int().min(1).max(20).default(5),
        type: z.string().min(1).default('all'),
      }),
    },
    async ({ date = new Date().toISOString().slice(0, 10), limit = 5, type = 'all' }: { date?: string; limit?: number; type?: string }) => {
      const { rankUrl, results } = await fetchTrendingQuestions(date, limit, type, bindings);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                date,
                limit,
                type,
                url: rankUrl,
                result_count: results.length,
                results,
              },
              null,
              2
            ),
          },
        ],
        structuredContent: {
          date,
          limit,
          type,
          url: rankUrl,
          result_count: results.length,
          results,
        },
      };
    }
  );

  return server;
};

const createStatelessTransport = () => {
  return new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'mcp-session-id', 'Last-Event-ID', 'mcp-protocol-version'],
    exposeHeaders: ['mcp-session-id', 'mcp-protocol-version'],
  })
);

app.get('/', (c) =>
  c.json({
    name: getConfig(c.env).serverName,
    version: getConfig(c.env).serverVersion,
    transport: 'streamable-http',
    mcp_endpoint: '/mcp',
    health_endpoint: '/health',
  })
);

app.get('/health', (c) => c.json({ status: 'ok', server: getConfig(c.env).serverName }));

app.post('/mcp', async (c) => {
  const transport = createStatelessTransport();
  const server = createServer(c.env);
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

app.delete('/mcp', (c) => c.json({ status: 'ok' }));

app.get('/mcp', (c) =>
  c.json({
    name: getConfig(c.env).serverName,
    version: getConfig(c.env).serverVersion,
    transport: 'streamable-http',
    mcp_endpoint: '/mcp',
  })
);

export default app;
