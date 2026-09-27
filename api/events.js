// api/events.js
// FFVN.TGM - FREE FIRE EVENTS API
// Vercel Serverless Function
// Không cần ?key=...

const NENCER_API_URL = "https://api.nencer.vn/ff/events";

const CACHE_TTL = 60 * 1000;

let cache = {
  data: null,
  expiresAt: 0
};

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

function json(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.json(data);
}

function query(req, key) {
  const value = req.query?.[key];

  if (Array.isArray(value)) {
    return String(value[0] || "");
  }

  return value == null ? "" : String(value);
}

function date(value) {
  if (!value) return null;

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? null
    : d;
}

function statusOf(start, end) {
  const now = Date.now();

  if (end && now >= end.getTime()) {
    return "ENDED";
  }

  if (start && now < start.getTime()) {
    return "UPCOMING";
  }

  if (start && now >= start.getTime()) {
    if (!end || now < end.getTime()) {
      return "ACTIVE";
    }
  }

  return "UNKNOWN";
}

function normalizeEvent(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

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

  const start = date(startRaw);
  const end = date(endRaw);

  return {
    id: String(id),
    name,
    description,
    type: String(type),
    image,

    start_at: start
      ? start.toISOString()
      : null,

    end_at: end
      ? end.toISOString()
      : null,

    status: statusOf(start, end),

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

  const candidates = [
    payload.data,
    payload.events,
    payload.items,
    payload.results,
    payload.result
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === "object") {
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

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getServerCodes(item) {
  const value =
    item.servers ??
    item.server ??
    item.regions ??
    item.region ??
    item.region_code ??
    item.regionCode ??
    item.country ??
    item.countries ??
    null;

  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap(v => {
        if (v && typeof v === "object") {
          return [
            v.code,
            v.region,
            v.server,
            v.country
          ];
        }

        return [v];
      })
      .filter(Boolean)
      .map(normalizeCode);
  }

  if (typeof value === "object") {
    return [
      value.code,
      value.region,
      value.server,
      value.country
    ]
      .filter(Boolean)
      .map(normalizeCode);
  }

  return String(value)
    .split(/[,\s|]+/)
    .filter(Boolean)
    .map(normalizeCode);
}

function belongsToServer(event, server) {
  if (!server) {
    return true;
  }

  const codes =
    getServerCodes(event.raw || {});

  /*
   * Không tự bịa server.
   * Chỉ trả event cho server nếu upstream
   * thực sự cung cấp thông tin server/region.
   */
  if (codes.length === 0) {
    return false;
  }

  return codes.includes(server);
}

function filterEvents(events, req) {
  const server =
    normalizeCode(query(req, "server"));

  const status =
    normalizeCode(query(req, "status"));

  const type =
    normalizeCode(query(req, "type"));

  const search =
    query(req, "search")
      .trim()
      .toLowerCase();

  let result = events;

  if (server) {
    result = result.filter(event =>
      belongsToServer(event, server)
    );
  }

  if (status) {
    result = result.filter(event =>
      event.status === status
    );
  }

  if (type) {
    result = result.filter(event =>
      String(event.type)
        .toUpperCase() === type
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

async function requestNencer() {
  const apiKey =
    process.env.NENCER_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "NENCER_API_KEY chưa được cấu hình."
    );

    error.code = "NO_NENCER_KEY";

    throw error;
  }

  const url =
    new URL(NENCER_API_URL);

  url.searchParams.set(
    "api_key",
    apiKey
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, 10000);

  try {
    const response =
      await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      });

    const text =
      await response.text();

    let payload;

    try {
      payload =
        text ? JSON.parse(text) : null;
    } catch {
      const error = new Error(
        "Nencer không trả về JSON hợp lệ."
      );

      error.code =
        "INVALID_UPSTREAM_JSON";

      throw error;
    }

    if (!response.ok) {
      const error = new Error(
        payload?.message ||
        payload?.error ||
        `Nencer HTTP ${response.status}`
      );

      error.status =
        response.status;

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        error.code =
          "INVALID_NENCER_KEY";
      }

      throw error;
    }

    return payload;

  } finally {
    clearTimeout(timeout);
  }
}

async function getData() {
  const now = Date.now();

  if (
    cache.data &&
    cache.expiresAt > now
  ) {
    return {
      data: cache.data,
      cached: true
    };
  }

  const data =
    await requestNencer();

  cache.data = data;

  cache.expiresAt =
    now + CACHE_TTL;

  return {
    data,
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

  // OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // GET only
  if (req.method !== "GET") {
    return json(res, 405, {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message:
        "Chỉ hỗ trợ phương thức GET."
    });
  }

  try {
    const result =
      await getData();

    const rawEvents =
      extractEvents(result.data);

    const events =
      rawEvents
        .map(normalizeEvent)
        .filter(Boolean);

    const filtered =
      filterEvents(events, req);

    const server =
      normalizeCode(
        query(req, "server")
      );

    const status =
      query(req, "status");

    const type =
      query(req, "type");

    const search =
      query(req, "search");

    return json(res, 200, {
      success: true,

      api: {
        name:
          "FFVN.TGM Free Fire Events API",
        version: "3.0.0",
        mode: "API_ONLY"
      },

      source: {
        provider:
          "Nencer Software",
        endpoint:
          NENCER_API_URL,
        cache:
          result.cached,
        cache_ttl_seconds: 60
      },

      request: {
        server: server || null,
        status: status || null,
        type: type || null,
        search: search || null
      },

      servers:
        Object.entries(SERVERS)
          .map(([code, name]) => ({
            code,
            name
          })),

      total:
        filtered.length,

      events:
        filtered,

      updated_at:
        new Date().toISOString()
    });

  } catch (error) {
    console.error(
      "FFVN.TGM API ERROR:",
      error
    );

    if (
      error.code ===
      "NO_NENCER_KEY"
    ) {
      return json(res, 500, {
        success: false,
        error:
          "NENCER_API_KEY_MISSING",
        message:
          "Chưa thêm NENCER_API_KEY vào Vercel Environment Variables."
      });
    }

    if (
      error.code ===
      "INVALID_NENCER_KEY"
    ) {
      return json(res, 502, {
        success: false,
        error:
          "INVALID_NENCER_API_KEY",
        message:
          "NENCER_API_KEY không hợp lệ hoặc không có quyền truy cập API Events."
      });
    }

    if (
      error.code ===
      "INVALID_UPSTREAM_JSON"
    ) {
      return json(res, 502, {
        success: false,
        error:
          "INVALID_UPSTREAM_JSON",
        message:
          "Nencer không trả về dữ liệu JSON hợp lệ."
      });
    }

    if (
      error.name ===
      "AbortError"
    ) {
      return json(res, 504, {
        success: false,
        error:
          "NENCER_TIMEOUT",
        message:
          "Nencer phản hồi quá thời gian chờ."
      });
    }

    return json(res, 502, {
      success: false,
      error:
        "EVENT_SOURCE_ERROR",
      message:
        error.message ||
        "Không thể lấy dữ liệu Event Free Fire."
    });
  }
};
