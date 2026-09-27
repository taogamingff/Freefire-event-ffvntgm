// api/events.js

const SERVERS = {
  VN: "Vietnam",
  TH: "Thailand",
  ID: "Indonesia",
  SG: "Singapore",
  MY: "Malaysia",
  PH: "Philippines",
  IN: "India",
  BR: "Brazil",
  US: "North America",
  EU: "Europe",
  ME: "Middle East",
  PK: "Pakistan",
  BD: "Bangladesh",
  LATAM: "Latin America",
  CIS: "CIS"
};

/*
 * ============================================================
 * DỮ LIỆU EVENT
 * ============================================================
 *
 * Thay DATA_SOURCE bằng nguồn dữ liệu thực tế của bạn.
 *
 * Không nên tự tạo tên event/thời gian/phần thưởng rồi gọi đó
 * là dữ liệu chính thức của Free Fire.
 *
 * Mỗi event có dạng:
 *
 * {
 *   id: "unique-event-id",
 *   server: "VN",
 *   title: "Tên sự kiện",
 *   description: "Mô tả",
 *   banner: "https://...",
 *   start_at: "2026-09-27T00:00:00+07:00",
 *   end_at: "2026-09-30T23:59:59+07:00",
 *   rewards: [],
 *   type: "event",
 *   source: "..."
 * }
 *
 * ============================================================
 */

const DATA_SOURCE = {
  VN: [],
  TH: [],
  ID: [],
  SG: [],
  MY: [],
  PH: [],
  IN: [],
  BR: [],
  US: [],
  EU: [],
  ME: [],
  PK: [],
  BD: [],
  LATAM: [],
  CIS: []
};


/*
 * ============================================================
 * HELPER
 * ============================================================
 */

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}


function getStatus(startAt, endAt) {
  const now = Date.now();

  const start = parseDate(startAt);
  const end = parseDate(endAt);

  if (!start || !end) {
    return "UNKNOWN";
  }

  if (now < start.getTime()) {
    return "UPCOMING";
  }

  if (now >= start.getTime() && now <= end.getTime()) {
    return "ACTIVE";
  }

  return "ENDED";
}


function getRemaining(startAt, endAt) {
  const now = Date.now();

  const start = parseDate(startAt);
  const end = parseDate(endAt);

  if (!start || !end) {
    return {
      milliseconds: null,
      seconds: null
    };
  }

  if (now < start.getTime()) {
    const ms = start.getTime() - now;

    return {
      milliseconds: ms,
      seconds: Math.floor(ms / 1000)
    };
  }

  if (now <= end.getTime()) {
    const ms = end.getTime() - now;

    return {
      milliseconds: ms,
      seconds: Math.floor(ms / 1000)
    };
  }

  return {
    milliseconds: 0,
    seconds: 0
  };
}


function normalizeEvent(event, server) {
  const startAt = event.start_at || event.startAt || null;
  const endAt = event.end_at || event.endAt || null;

  const status = getStatus(startAt, endAt);
  const remaining = getRemaining(startAt, endAt);

  return {
    id: String(event.id || ""),
    server: server,
    server_name: SERVERS[server] || server,

    title: event.title || "",
    description: event.description || "",

    banner: event.banner || null,

    type: event.type || "event",

    start_at: startAt,
    end_at: endAt,

    status: status,

    remaining: remaining,

    rewards: Array.isArray(event.rewards)
      ? event.rewards
      : [],

    source: event.source || null
  };
}


/*
 * ============================================================
 * LẤY EVENT
 * ============================================================
 */

async function getEvents() {
  /*
   * Hiện tại sử dụng DATA_SOURCE.
   *
   * Nếu sau này bạn có API nguồn dữ liệu thực tế,
   * có thể thay phần này bằng fetch().
   */

  const result = [];

  for (const server of Object.keys(SERVERS)) {
    const events = Array.isArray(DATA_SOURCE[server])
      ? DATA_SOURCE[server]
      : [];

    for (const event of events) {
      result.push(
        normalizeEvent(event, server)
      );
    }
  }

  return result;
}


/*
 * ============================================================
 * SORT EVENT
 * ============================================================
 */

function sortEvents(events) {
  const order = {
    ACTIVE: 0,
    UPCOMING: 1,
    ENDED: 2,
    UNKNOWN: 3
  };

  return events.sort((a, b) => {

    const statusA = order[a.status] ?? 99;
    const statusB = order[b.status] ?? 99;

    if (statusA !== statusB) {
      return statusA - statusB;
    }

    const dateA = parseDate(a.start_at);
    const dateB = parseDate(b.start_at);

    const timeA = dateA
      ? dateA.getTime()
      : Number.MAX_SAFE_INTEGER;

    const timeB = dateB
      ? dateB.getTime()
      : Number.MAX_SAFE_INTEGER;

    return timeA - timeB;
  });
}


/*
 * ============================================================
 * API HANDLER
 * ============================================================
 */

module.exports = async function handler(req, res) {

  /*
   * CORS
   */

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

  /*
   * OPTIONS
   */

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  /*
   * Chỉ cho GET
   */

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "API chỉ hỗ trợ phương thức GET."
    });
  }

  try {

    const {
      server = "all",
      status = "all",
      type = "all",
      q = "",
      include_ended = "true"
    } = req.query || {};

    /*
     * Kiểm tra server
     */

    const normalizedServer =
      String(server).trim().toUpperCase();

    if (
      normalizedServer !== "ALL" &&
      !SERVERS[normalizedServer]
    ) {
      return res.status(400).json({
        success: false,
        error: "INVALID_SERVER",
        message: "Server không hợp lệ.",
        available_servers: Object.keys(SERVERS)
      });
    }

    /*
     * Lấy dữ liệu
     */

    let events = await getEvents();

    /*
     * Filter server
     */

    if (normalizedServer !== "ALL") {
      events = events.filter(
        event =>
          event.server === normalizedServer
      );
    }

    /*
     * Filter status
     */

    const normalizedStatus =
      String(status).trim().toUpperCase();

    if (normalizedStatus !== "ALL") {

      const allowedStatus = [
        "ACTIVE",
        "UPCOMING",
        "ENDED",
        "UNKNOWN"
      ];

      if (!allowedStatus.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          error: "INVALID_STATUS",
          message: "Status không hợp lệ.",
          available_status: allowedStatus
        });
      }

      events = events.filter(
        event =>
          event.status === normalizedStatus
      );
    }

    /*
     * Filter type
     */

    if (
      String(type).trim().toLowerCase() !== "all"
    ) {

      const requestedType =
        String(type).trim().toLowerCase();

      events = events.filter(
        event =>
          String(event.type)
            .toLowerCase() === requestedType
      );
    }

    /*
     * Search
     */

    const search =
      String(q).trim().toLowerCase();

    if (search) {

      events = events.filter(event => {

        const text = [
          event.id,
          event.title,
          event.description,
          event.type,
          event.server,
          event.server_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(search);
      });
    }

    /*
     * include_ended
     */

    if (
      String(include_ended).toLowerCase() === "false"
    ) {
      events = events.filter(
        event =>
          event.status !== "ENDED"
      );
    }

    /*
     * Sort
     */

    events = sortEvents(events);

    /*
     * Thời gian server
     */

    const now = new Date();

    /*
     * Response
     */

    return res.status(200).json({

      success: true,

      api: {
        name: "Free Fire Events API",
        version: "1.0.0"
      },

      generated_at: now.toISOString(),

      timezone: "Asia/Ho_Chi_Minh",

      request: {
        server: normalizedServer,
        status: normalizedStatus,
        type: type,
        search: search || null,
        include_ended:
          String(include_ended).toLowerCase() !== "false"
      },

      servers: SERVERS,

      total: events.length,

      events: events

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error: "INTERNAL_SERVER_ERROR",

      message:
        "Không thể đọc dữ liệu sự kiện.",

      detail:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined

    });
  }
};
