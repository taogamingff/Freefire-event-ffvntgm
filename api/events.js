/**
 * FREE FIRE EVENTS API
 * API ONLY - VERCEL
 *
 * Endpoint:
 * /api/events
 * /api/events?server=VN
 * /api/events?server=VN&status=ACTIVE
 * /api/events?server=all
 * /api/events?q=keyword
 */

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
|--------------------------------------------------------------------------
| DỮ LIỆU
|--------------------------------------------------------------------------
|
| Đây là nơi API nhận dữ liệu event.
|
| Bạn có thể kết nối nguồn dữ liệu thực tế vào đây.
|
| Không tự tạo event giả để đại diện cho dữ liệu chính thức của Free Fire.
|
*/

const EVENTS = {
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
|--------------------------------------------------------------------------
| DATE
|--------------------------------------------------------------------------
*/

function toDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

function getStatus(startAt, endAt) {
  const now = Date.now();

  const start = toDate(startAt);
  const end = toDate(endAt);

  if (!start || !end) {
    return "UNKNOWN";
  }

  if (now < start.getTime()) {
    return "UPCOMING";
  }

  if (now <= end.getTime()) {
    return "ACTIVE";
  }

  return "ENDED";
}

/*
|--------------------------------------------------------------------------
| COUNTDOWN
|--------------------------------------------------------------------------
*/

function getCountdown(startAt, endAt) {
  const now = Date.now();

  const start = toDate(startAt);
  const end = toDate(endAt);

  if (!start || !end) {
    return {
      milliseconds: null,
      seconds: null,
      minutes: null,
      hours: null,
      days: null
    };
  }

  let milliseconds;

  if (now < start.getTime()) {
    milliseconds = start.getTime() - now;
  } else if (now <= end.getTime()) {
    milliseconds = end.getTime() - now;
  } else {
    milliseconds = 0;
  }

  return {
    milliseconds,
    seconds: Math.floor(milliseconds / 1000),
    minutes: Math.floor(milliseconds / 60000),
    hours: Math.floor(milliseconds / 3600000),
    days: Math.floor(milliseconds / 86400000)
  };
}

/*
|--------------------------------------------------------------------------
| NORMALIZE EVENT
|--------------------------------------------------------------------------
*/

function normalizeEvent(event, server) {
  const startAt =
    event.start_at ||
    event.startAt ||
    null;

  const endAt =
    event.end_at ||
    event.endAt ||
    null;

  const status =
    getStatus(startAt, endAt);

  return {
    id: String(
      event.id || ""
    ),

    server,

    server_name:
      SERVERS[server] || server,

    title:
      event.title || "",

    description:
      event.description || "",

    banner:
      event.banner || null,

    type:
      event.type || "event",

    start_at:
      startAt,

    end_at:
      endAt,

    status,

    countdown:
      getCountdown(
        startAt,
        endAt
      ),

    rewards:
      Array.isArray(event.rewards)
        ? event.rewards
        : [],

    source:
      event.source || null
  };
}

/*
|--------------------------------------------------------------------------
| GET ALL EVENTS
|--------------------------------------------------------------------------
*/

function getAllEvents() {
  const result = [];

  Object.keys(SERVERS).forEach(server => {

    const list =
      Array.isArray(EVENTS[server])
        ? EVENTS[server]
        : [];

    list.forEach(event => {

      result.push(
        normalizeEvent(
          event,
          server
        )
      );

    });

  });

  return result;
}

/*
|--------------------------------------------------------------------------
| SORT
|--------------------------------------------------------------------------
*/

function sortEvents(events) {

  const priority = {
    ACTIVE: 1,
    UPCOMING: 2,
    ENDED: 3,
    UNKNOWN: 4
  };

  return events.sort((a, b) => {

    const pA =
      priority[a.status] || 99;

    const pB =
      priority[b.status] || 99;

    if (pA !== pB) {
      return pA - pB;
    }

    const aDate =
      toDate(a.start_at);

    const bDate =
      toDate(b.start_at);

    const aTime =
      aDate
        ? aDate.getTime()
        : Number.MAX_SAFE_INTEGER;

    const bTime =
      bDate
        ? bDate.getTime()
        : Number.MAX_SAFE_INTEGER;

    return aTime - bTime;
  });
}

/*
|--------------------------------------------------------------------------
| HANDLER
|--------------------------------------------------------------------------
*/

module.exports = function handler(req, res) {

  /*
  |--------------------------------------------------------------------------
  | CORS
  |--------------------------------------------------------------------------
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
  |--------------------------------------------------------------------------
  | OPTIONS
  |--------------------------------------------------------------------------
  */

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  /*
  |--------------------------------------------------------------------------
  | METHOD
  |--------------------------------------------------------------------------
  */

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message:
        "Chỉ hỗ trợ phương thức GET."
    });
  }

  try {

    /*
    |--------------------------------------------------------------------------
    | QUERY
    |--------------------------------------------------------------------------
    */

    const server =
      String(
        req.query.server || "all"
      ).trim().toUpperCase();

    const status =
      String(
        req.query.status || "all"
      ).trim().toUpperCase();

    const type =
      String(
        req.query.type || "all"
      ).trim().toLowerCase();

    const search =
      String(
        req.query.q || ""
      ).trim().toLowerCase();

    const includeEnded =
      String(
        req.query.include_ended || "true"
      ).toLowerCase() !== "false";

    /*
    |--------------------------------------------------------------------------
    | CHECK SERVER
    |--------------------------------------------------------------------------
    */

    if (
      server !== "ALL" &&
      !SERVERS[server]
    ) {

      return res.status(400).json({

        success: false,

        error:
          "INVALID_SERVER",

        message:
          "Server không tồn tại.",

        available_servers:
          Object.keys(SERVERS)

      });

    }

    /*
    |--------------------------------------------------------------------------
    | CHECK STATUS
    |--------------------------------------------------------------------------
    */

    const validStatuses = [
      "ALL",
      "ACTIVE",
      "UPCOMING",
      "ENDED",
      "UNKNOWN"
    ];

    if (!validStatuses.includes(status)) {

      return res.status(400).json({

        success: false,

        error:
          "INVALID_STATUS",

        available_status:
          validStatuses

      });

    }

    /*
    |--------------------------------------------------------------------------
    | LOAD
    |--------------------------------------------------------------------------
    */

    let events =
      getAllEvents();

    /*
    |--------------------------------------------------------------------------
    | SERVER FILTER
    |--------------------------------------------------------------------------
    */

    if (server !== "ALL") {

      events =
        events.filter(
          event =>
            event.server === server
        );

    }

    /*
    |--------------------------------------------------------------------------
    | STATUS FILTER
    |--------------------------------------------------------------------------
    */

    if (status !== "ALL") {

      events =
        events.filter(
          event =>
            event.status === status
        );

    }

    /*
    |--------------------------------------------------------------------------
    | TYPE FILTER
    |--------------------------------------------------------------------------
    */

    if (type !== "all") {

      events =
        events.filter(
          event =>
            String(
              event.type
            ).toLowerCase() === type
        );

    }

    /*
    |--------------------------------------------------------------------------
    | SEARCH
    |--------------------------------------------------------------------------
    */

    if (search) {

      events =
        events.filter(event => {

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
    |--------------------------------------------------------------------------
    | HIDE ENDED
    |--------------------------------------------------------------------------
    */

    if (!includeEnded) {

      events =
        events.filter(
          event =>
            event.status !== "ENDED"
        );

    }

    /*
    |--------------------------------------------------------------------------
    | SORT
    |--------------------------------------------------------------------------
    */

    events =
      sortEvents(events);

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({

      success: true,

      api: {
        name:
          "Free Fire Events API",

        version:
          "1.0.0",

        mode:
          "API_ONLY"
      },

      generated_at:
        new Date().toISOString(),

      timezone:
        "Asia/Ho_Chi_Minh",

      request: {

        server,

        status,

        type,

        search:
          search || null,

        include_ended:
          includeEnded

      },

      servers:
        SERVERS,

      total:
        events.length,

      events

    });

  } catch (error) {

    console.error(
      "Free Fire Events API Error:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        "INTERNAL_SERVER_ERROR",

      message:
        "Không thể xử lý dữ liệu sự kiện."

    });

  }
};
