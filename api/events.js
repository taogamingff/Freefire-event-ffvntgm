// api/events.js
// FFVN.TGM - Free Fire Events API
// Vercel Serverless Function - Node.js

const NENCER_API_URL = "https://api.nencer.vn/ff/events";

// Cache trong bộ nhớ của instance Vercel.
// Không đảm bảo tồn tại giữa mọi lần cold start.
let cache = {
  data: null,
  expiresAt: 0
};

const CACHE_TTL = 60 * 1000; // 60 giây

const SERVERS = {
  VN: "Việt Nam",
  TH: "Thái Lan",
  ID: "Indonesia",
  SG: "Singapore",
  MY: "Malaysia",
  PH: "Philippines",
  IN: "Ấn Độ",
  BR: "Brazil",
  US: "Bắc Mỹ",
  EU: "Châu Âu",
  ME: "Trung Đông",
  PK: "Pakistan",
  BD: "Bangladesh",
  LATAM: "Mỹ Latinh",
  CIS: "CIS"
};

function sendJSON(res, status, data) {
  return res.status(status).json(data);
}

function getQuery(req, name, fallback = "") {
  if (!req.query) return fallback;

  const value = req.query[name];

  if (Array.isArray(value)) {
    return String(value[0] || fallback);
  }

  return value == null ? fallback : String(value);
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getStatus(start, end) {
  const now = Date.now();

  const startTime = start ? start.getTime() : null;
  const endTime = end ? end.getTime() : null;

  if (endTime && now >= endTime) {
    return "ENDED";
  }

  if (startTime && now < startTime) {
    return "UPCOMING";
  }

  if (startTime && (!endTime || now < endTime)) {
    return "ACTIVE";
  }

  return "UNKNOWN";
}

function normalizeEvent(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  // Hỗ trợ nhiều cách đặt tên trường từ upstream.
  const id =
    item.id ??
    item.event_id ??
    item.eventId ??
    item.code ??
    `event-${index + 1}`;

  const name =
    item.name ??
    item.title ??
    item.event_name ??
    item.eventName ??
    null;

  const description =
    item.description ??
    item.desc ??
    item.content ??
    "";

  const image =
    item.image ??
    item.image_url ??
    item.imageUrl ??
    item.banner ??
    item.banner_url ??
    item.thumbnail ??
    null;

  const type =
    item.type ??
    item.category ??
    item.event_type ??
    "EVENT";

  const startRaw =
    item.start_time ??
    item.startTime ??
    item.start_at ??
    item.startAt ??
    item.start_date ??
    item.startDate ??
    item.from ??
    null;

  const endRaw =
    item.end_time ??
    item.endTime ??
    item.end_at ??
    item.endAt ??
    item.end_date ??
    item.endDate ??
    item.to ??
    null;

  const start = parseDate(startRaw);
  const end = parseDate(endRaw);

  // Không tự tạo ngày giờ nếu upstream không cung cấp.
  const status = getStatus(start, end);

  return {
    id: String(id),
    name,
    description,
    type: String(type),
    image,

    start_at: start ? start.toISOString() : null,
    end_at: end ? end.toISOString() : null,

    status,

    source: "Nencer API",

    raw: item
  };
}

function extractEvents(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const possibleArrays = [
    payload.data,
    payload.events,
    payload.items,
    payload.results,
    payload.result
  ];

  for (const value of possibleArrays) {
    if (Array.isArray(value)) {
      return value;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      if (Array.isArray(value.events)) {
        return value.events;
      }

      if (Array.isArray(value.items)) {
        return value.items;
      }

      if (Array.isArray(value.data)) {
        return value.data;
      }
    }
  }

  return [];
}

function normalizeRegion(value) {
  if (!value) return null;

  return String(value)
    .trim()
    .toUpperCase();
}

function getEventServers(item) {
  const possible =
    item.servers ??
    item.server ??
    item.regions ??
    item.region ??
    item.region_code ??
    item.regionCode ??
    item.country ??
    item.countries ??
    null;

  if (!possible) {
    return [];
  }

  if (Array.isArray(possible)) {
    return possible
      .flatMap(value => {
        if (
          value &&
          typeof value === "object"
        ) {
          return [
            value.code,
            value.region,
            value.server,
            value.country
          ];
        }

        return [value];
      })
      .filter(Boolean)
      .map(normalizeRegion);
  }

  if (typeof possible === "object") {
    return [
      possible.code,
      possible.region,
      possible.server,
      possible.country
    ]
      .filter(Boolean)
      .map(normalizeRegion);
  }

  return String(possible)
    .split(/[,\s|]+/)
    .filter(Boolean)
    .map(normalizeRegion);
}

function eventMatchesServer(event, server) {
  if (!server) {
    return true;
  }

  const raw = event.raw || {};
  const regions = getEventServers(raw);

  // Nếu upstream không cung cấp thông tin server,
  // không giả mạo rằng event thuộc server đó.
  if (regions.length === 0) {
    return false;
  }

  return regions.includes(server);
}

function applyFilters(events, req) {
  const server = normalizeRegion(
    getQuery(req, "server")
  );

  const status = normalizeRegion(
    getQuery(req, "status")
  );

  const type = normalizeRegion(
    getQuery(req, "type")
  );

  const search = getQuery(req, "search")
    .trim()
    .toLowerCase();

  let result = events;

  if (server) {
    result = result.filter(event =>
      eventMatchesServer(event, server)
    );
  }

  if (status) {
    result = result.filter(event =>
      event.status === status
    );
  }

  if (type) {
    result = result.filter(event =>
      String(event.type).toUpperCase() === type
    );
  }

  if (search) {
    result = result.filter(event => {
      const text = [
        event.name,
        event.description,
        event.type
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }

  return result;
}

async function fetchNencerEvents() {
  const apiKey = process.env.NENCER_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "NENCER_API_KEY chưa được cấu hình trên Vercel."
    );

    error.code = "MISSING_API_KEY";

    throw error;
  }

  const url = new URL(NENCER_API_URL);

  url.searchParams.set(
    "api_key",
    apiKey
  );

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    10000
  );

  try {
    const response = await fetch(
      url.toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      }
    );

    const text = await response.text();

    let payload;

    try {
      payload = text
        ? JSON.parse(text)
        : null;
    } catch {
      const error = new Error(
        "Nencer trả về dữ liệu không phải JSON."
      );

      error.code = "UPSTREAM_INVALID_JSON";
      error.status = response.status;

      throw error;
    }

    if (!response.ok) {
      const error = new Error(
        payload?.message ||
        payload?.error ||
        `Nencer HTTP ${response.status}`
      );

      error.code =
        response.status === 401 ||
        response.status === 403
          ? "INVALID_NENCER_API_KEY"
          : `NENCER_HTTP_${response.status}`;

      error.status = response.status;
      error.payload = payload;

      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function getEvents() {
  const now = Date.now();

  if (
    cache.data &&
    cache.expiresAt > now
  ) {
    return {
      payload: cache.data,
      cached: true
    };
  }

  const payload =
    await fetchNencerEvents();

  cache.data = payload;
  cache.expiresAt =
    now + CACHE_TTL;

  return {
    payload,
    cached: false
  };
}

module.exports = async function handler(
  req,
  res
) {
  // CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Chỉ GET
  if (req.method !== "GET") {
    return sendJSON(res, 405, {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "API này chỉ hỗ trợ GET."
    });
  }

  // Key riêng của API FFVN.TGM
  const clientKey =
    getQuery(req, "key");

  const privateKey =
    process.env.FFVNTGM_API_KEY;

  if (privateKey) {
    if (clientKey !== privateKey) {
      return sendJSON(res, 401, {
        success: false,
        error: "INVALID_API_KEY",
        message: "API key FFVNTGM không hợp lệ."
      });
    }
  }

  try {
    const result =
      await getEvents();

    const rawEvents =
      extractEvents(result.payload);

    const normalized =
      rawEvents
        .map(normalizeEvent)
        .filter(Boolean);

    const filtered =
      applyFilters(
        normalized,
        req
      );

    const server =
      normalizeRegion(
        getQuery(req, "server")
      );

    const response = {
      success: true,

      api: {
        name:
          "FFVN.TGM Free Fire Events API",
        version: "2.1.0",
        mode: "API_ONLY"
      },

      source: {
        provider: "Nencer Software",
        endpoint:
          NENCER_API_URL,
        cached: result.cached
      },

      request: {
        server: server || null,
        status:
          getQuery(req, "status") || null,
        type:
          getQuery(req, "type") || null,
        search:
          getQuery(req, "search") || null
      },

      servers: Object.entries(
        SERVERS
      ).map(([code, name]) => ({
        code,
        name
      })),

      total: filtered.length,

      events: filtered,

      updated_at:
        new Date().toISOString()
    };

    // Không có dữ liệu
    if (
      filtered.length === 0
    ) {
      response.message =
        server
          ? `Không có event có thông tin server ${server} từ nguồn dữ liệu hiện tại.`
          : "Nguồn dữ liệu hiện tại không trả về event.";
    }

    return sendJSON(
      res,
      200,
      response
    );

  } catch (error) {
    console.error(
      "FFVN.TGM EVENTS ERROR:",
      error
    );

    if (
      error.code ===
      "MISSING_API_KEY"
    ) {
      return sendJSON(res, 500, {
        success: false,
        error: "MISSING_NENCER_API_KEY",
        message:
          "Chưa cấu hình NENCER_API_KEY trên Vercel."
      });
    }

    if (
      error.code ===
      "INVALID_NENCER_API_KEY"
    ) {
      return sendJSON(res, 502, {
        success: false,
        error:
          "INVALID_NENCER_API_KEY",
        message:
          "Nencer API Key không hợp lệ hoặc không được cấp quyền truy cập endpoint events."
      });
    }

    if (
      error.code ===
      "UPSTREAM_INVALID_JSON"
    ) {
      return sendJSON(res, 502, {
        success: false,
        error:
          "UPSTREAM_INVALID_JSON",
        message:
          "Nguồn Nencer không trả về JSON hợp lệ."
      });
    }

    if (
      error.name ===
      "AbortError"
    ) {
      return sendJSON(res, 504, {
        success: false,
        error: "UPSTREAM_TIMEOUT",
        message:
          "Nencer phản hồi quá thời gian chờ."
      });
    }

    return sendJSON(res, 502, {
      success: false,
      error: "UPSTREAM_ERROR",
      message:
        error.message ||
        "Không thể lấy dữ liệu event từ Nencer."
    });
  }
};
