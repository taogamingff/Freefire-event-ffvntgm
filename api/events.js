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

function date(value) {
  if (!value) return null;

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? null
    : d;
}

function getStatus(start, end) {
  const now = Date.now();

  const s = date(start);
  const e = date(end);

  if (!s || !e) {
    return "UNKNOWN";
  }

  if (now < s.getTime()) {
    return "UPCOMING";
  }

  if (now <= e.getTime()) {
    return "ACTIVE";
  }

  return "ENDED";
}

function countdown(start, end) {
  const now = Date.now();

  const s = date(start);
  const e = date(end);

  if (!s || !e) {
    return null;
  }

  let remaining = 0;

  if (now < s.getTime()) {
    remaining = s.getTime() - now;
  } else if (now < e.getTime()) {
    remaining = e.getTime() - now;
  }

  return {
    milliseconds: remaining,
    seconds: Math.floor(remaining / 1000),
    minutes: Math.floor(remaining / 60000),
    hours: Math.floor(remaining / 3600000),
    days: Math.floor(remaining / 86400000)
  };
}

function normalize(event, server) {
  const start =
    event.start_at ||
    event.startAt ||
    null;

  const end =
    event.end_at ||
    event.endAt ||
    null;

  return {
    id: String(event.id || ""),
    server,
    server_name: SERVERS[server],

    title: event.title || "",
    description: event.description || "",

    banner: event.banner || null,

    type: event.type || "event",

    start_at: start,
    end_at: end,

    status: getStatus(start, end),

    countdown: countdown(start, end),

    rewards: Array.isArray(event.rewards)
      ? event.rewards
      : [],

    source: event.source || null
  };
}

function allEvents() {
  const result = [];

  for (const server of Object.keys(SERVERS)) {
    const list = EVENTS[server];

    if (!Array.isArray(list)) {
      continue;
    }

    for (const event of list) {
      result.push(
        normalize(event, server)
      );
    }
  }

  return result;
}

module.exports = function handler(req, res) {

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

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "METHOD_NOT_ALLOWED"
    });
  }

  try {

    const server =
      String(
        req.query?.server || "all"
      ).toUpperCase();

    const status =
      String(
        req.query?.status || "all"
      ).toUpperCase();

    const search =
      String(
        req.query?.q || ""
      ).toLowerCase()
      .trim();

    const includeEnded =
      String(
        req.query?.include_ended || "true"
      ).toLowerCase() !== "false";

    if (
      server !== "ALL" &&
      !SERVERS[server]
    ) {
      return res.status(400).json({
        success: false,
        error: "INVALID_SERVER",
        available_servers:
          Object.keys(SERVERS)
      });
    }

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
        error: "INVALID_STATUS",
        available_status:
          validStatuses
      });
    }

    let events = allEvents();

    if (server !== "ALL") {
      events = events.filter(
        event =>
          event.server === server
      );
    }

    if (status !== "ALL") {
      events = events.filter(
        event =>
          event.status === status
      );
    }

    if (!includeEnded) {
      events = events.filter(
        event =>
          event.status !== "ENDED"
      );
    }

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
          .join(" ")
          .toLowerCase();

        return text.includes(search);
      });
    }

    const priority = {
      ACTIVE: 1,
      UPCOMING: 2,
      ENDED: 3,
      UNKNOWN: 4
    };

    events.sort((a, b) => {
      return (
        (priority[a.status] || 99) -
        (priority[b.status] || 99)
      );
    });

    return res.status(200).json({

      success: true,

      api: {
        name: "Free Fire Events API",
        version: "1.0.0",
        mode: "API_ONLY"
      },

      generated_at:
        new Date().toISOString(),

      timezone:
        "Asia/Ho_Chi_Minh",

      request: {
        server,
        status,
        search: search || null,
        include_ended: includeEnded
      },

      servers: SERVERS,

      total: events.length,

      events

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message:
        "Không thể xử lý API."
    });
  }
};
