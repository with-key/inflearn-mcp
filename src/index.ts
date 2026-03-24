import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { z } from 'zod';

type Bindings = {
  INFLEARN_BASE_URL?: string;
};

type SessionEntry = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
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

const SERVER_NAME = 'inflearn-mcp';
const SERVER_VERSION = '0.1.0';
const DEFAULT_BASE_URL = 'https://www.inflearn.com/community/questions';
const DEFAULT_API_BASE_URL = 'https://www.inflearn.com/api/community-posts/question';
const DEFAULT_RANK_API_BASE_URL = 'https://www.inflearn.com/api/v1/community/rank/post';
const SESSION_HEADER = 'mcp-session-id';

const sessions = new Map<string, SessionEntry>();
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

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'user-agent': `${SERVER_NAME}/${SERVER_VERSION} (+cloudflare-worker)`,
    },
  });

  if (!response.ok) {
    throw new Error(`Inflearn request failed with status ${response.status}`);
  }

  return (await response.json()) as unknown;
};

const fetchSearchResults = async (keyword: string | undefined, page: number) => {
  const searchUrl = new URL(DEFAULT_API_BASE_URL);
  searchUrl.searchParams.set('status', '');
  if (keyword && keyword.trim()) {
    searchUrl.searchParams.set('s', keyword);
  } else {
    searchUrl.searchParams.set('s', '');
  }
  searchUrl.searchParams.set('tag', '');
  searchUrl.searchParams.set('order', 'recent');
  searchUrl.searchParams.set('page', String(page));
  const payload = await fetchJson(searchUrl.toString());
  const records = extractQuestionRecords(payload);
  const results = records.map((record) => normalizeQuestionRecord(record, DEFAULT_BASE_URL));

  return {
    searchUrl: searchUrl.toString(),
    payload,
    results,
  };
};

const fetchTrendingQuestions = async (date: string, limit: number, type: string) => {
  const rankUrl = new URL(DEFAULT_RANK_API_BASE_URL);
  rankUrl.searchParams.set('date', date);
  rankUrl.searchParams.set('limit', String(limit));
  rankUrl.searchParams.set('type', type);
  rankUrl.searchParams.set('usedBy', 'gnb');

  const payload = await fetchJson(rankUrl.toString());
  const records = extractQuestionRecords(payload);
  const results = records.map((record) => normalizeQuestionRecord(record, DEFAULT_BASE_URL));

  return {
    rankUrl: rankUrl.toString(),
    payload,
    results,
  };
};

const createServer = (bindings?: Bindings) => {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
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
              server: SERVER_NAME,
              version: SERVER_VERSION,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        status: 'ok',
        server: SERVER_NAME,
        version: SERVER_VERSION,
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
      const { searchUrl, payload, results } = await fetchSearchResults(keyword, page);

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
                raw: payload,
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
          raw: payload,
        },
      };
    }
  );

  server.registerTool(
    'get_trending_questions',
    {
      title: 'Get Trending Inflearn Questions',
      description: 'Get weekly popular community posts from Inflearn rank API.',
      inputSchema: z.object({
        date: z.string().min(10).default('2026-03-25'),
        limit: z.number().int().min(1).max(20).default(5),
        type: z.string().min(1).default('all'),
      }),
    },
    async ({ date = '2026-03-25', limit = 5, type = 'all' }: { date?: string; limit?: number; type?: string }) => {
      const { rankUrl, payload, results } = await fetchTrendingQuestions(date, limit, type);

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
                raw: payload,
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
          raw: payload,
        },
      };
    }
  );

  server.registerTool(
    'get_question',
    {
      title: 'Get Inflearn Question',
      description: 'Fetch one public Inflearn question URL and return parsed details.',
      inputSchema: z.object({
        url: z.string().url(),
      }),
    },
    async ({ url }: { url: string }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              url,
              title: null,
              question: null,
              answers: [],
              note: 'Worker skeleton: implement Inflearn question parsing here.',
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        url,
        title: null,
        question: null,
        answers: [],
        note: 'Worker skeleton: implement Inflearn question parsing here.',
      },
    })
  );

  return server;
};

const isInitializeRequest = (body: unknown): boolean => {
  if (Array.isArray(body)) {
    return body.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'method' in item &&
        item.method === 'initialize'
    );
  }

  return typeof body === 'object' && body !== null && 'method' in body && body.method === 'initialize';
};

const createSessionTransport = (bindings?: Bindings) => {
  const server = createServer(bindings);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId: string) => {
      sessions.set(sessionId, { server, transport });
    },
    onsessionclosed: (sessionId: string) => {
      sessions.delete(sessionId);
    },
  });

  return { server, transport };
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) =>
  c.json({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    transport: 'streamable-http',
    mcp_endpoint: '/mcp',
    health_endpoint: '/health',
  })
);

app.get('/health', (c) => c.json({ status: 'ok', server: SERVER_NAME }));

app.all('/mcp', async (c) => {
  const sessionId = c.req.header(SESSION_HEADER);
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json(
        {
          error: 'Session not found',
          message: 'Unknown mcp-session-id. Start again with an initialize request.',
        },
        404
      );
    }

    return session.transport.handleRequest(c.req.raw);
  }

  if (c.req.method === 'POST') {
    const body = await c.req.raw.clone().json().catch(() => null);
    if (!isInitializeRequest(body)) {
      return c.json(
        {
          error: 'Missing session',
          message: 'The first POST request must be an initialize request.',
        },
        400
      );
    }

    const { server, transport } = createSessionTransport(c.env);
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  }

  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createServer(c.env);
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

export default app;
