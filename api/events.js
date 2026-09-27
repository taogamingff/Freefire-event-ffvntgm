/**
 * ============================================================
 * FREE FIRE EVENTS API
 * API ONLY - VERCEL
 * ============================================================
 *
 * Endpoint:
 *
 * /api/events
 * /api/events?server=VN
 * /api/events?server=VN&status=ACTIVE
 * /api/events?server=VN&status=UPCOMING
 * /api/events?server=all
 *
 * Nguồn dữ liệu:
 * NENCER EVENTS API
 *
 * API KEY KHÔNG ĐƯỢC ĐỂ TRỰC TIẾP TRONG CODE.
 * Đặt:
 *
 * NENCER_API_KEY
 *
 * trong Vercel Environment Variables.
 *
 * ============================================================
 */

const SERVERS = {
  VN: {
    name: "Vietnam",
    upstream: "vn"
  },

  TH: {
    name: "Thailand",
    upstream: "th"
  },

  ID: {
    name: "Indonesia",
    upstream: "id"
  },

  SG: {
    name: "Singapore",
    upstream: "sg"
  },

  MY: {
    name: "Malaysia",
    upstream: "my"
  },

  PH: {
    name: "Philippines",
    upstream: "ph"
  },

  IN: {
    name: "India",
    upstream: "ind"
  },

  BR: {
    name: "Brazil",
    upstream: "br"
  },

  US: {
    name: "North America",
    upstream: "us"
  },

  EU: {
    name: "Europe",
    upstream: "eu"
  },

  ME: {
    name: "Middle East",
    upstream: "me"
  },

  PK: {
    name: "Pakistan",
    upstream: "pk"
  },

  BD: {
    name: "Bangladesh",
    upstream: "bd"
  },

  LATAM: {
    name: "Latin America",
    upstream: "latam"
  },

  CIS: {
    name: "CIS",
    upstream: "cis"
  }
};


/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const UPSTREAM_URL =
  process.env.EVENTS_API_URL ||
  "https://api.nencer.vn/ff/events";

const API_KEY =
  process.env.NENCER_API_KEY || "";


/*
|--------------------------------------------------------------------------
| FETCH TIMEOUT
|--------------------------------------------------------------------------
*/

const FETCH_TIMEOUT = 12000;


/*
|--------------------------------------------------------------------------
| FETCH JSON
|--------------------------------------------------------------------------
*/

async function fetchJSON(url, options = {}) {

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT
    );

  try {

    const response =
      await fetch(url, {
        ...options,
        signal:
          controller.signal
      });

    const text =
      await response.text();

    let data;

    try {

      data =
        JSON.parse(text);

    } catch {

      data = {
        raw: text
      };

    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };

  } finally {

    clearTimeout(timeout);

  }
}


/*
|--------------------------------------------------------------------------
| BUILD UPSTREAM URL
|--------------------------------------------------------------------------
*/

function buildUpstreamURL(server) {

  const url =
    new URL(UPSTREAM_URL);

  /*
   * Một số nguồn hỗ trợ region/server,
   * một số nguồn có thể bỏ qua tham số này.
   */

  if (server && server !== "ALL") {

    const info =
      SERVERS[server];

    if (info) {

      url.searchParams.set(
        "region",
        info.upstream
      );

    }

  }

  /*
   * Nencer sử dụng api_key theo tài liệu
   */

  if (API_KEY) {

    url.searchParams.set(
      "api_key",
      API_KEY
    );

  }

  return url.toString();
}


/*
|--------------------------------------------------------------------------
| DATE PARSER
|--------------------------------------------------------------------------
*/

function parseDate(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  /*
   * Unix seconds
   */

  if (
    typeof value === "number" ||
    /^[0-9]+$/.test(
      String(value)
    )
  ) {

    const number =
      Number(value);

    /*
     * milliseconds
     */

    if (number > 100000000000) {
      const d =
        new Date(number);

      return Number.isNaN(
        d.getTime()
      )
        ? null
        : d;
    }

    /*
     * seconds
     */

    const d =
      new Date(number * 1000);

    return Number.isNaN(
      d.getTime()
    )
      ? null
      : d;
  }

  const d =
    new Date(value);

  return Number.isNaN(
    d.getTime()
  )
    ? null
    : d;
}


/*
|--------------------------------------------------------------------------
| FIND FIELD
|--------------------------------------------------------------------------
*/

function firstValue(
  object,
  fields
) {

  for (
    const field of fields
  ) {

    if (
      object &&
      object[field] !== undefined &&
      object[field] !== null &&
      object[field] !== ""
    ) {

      return object[field];

    }

  }

  return null;
}


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

function getStatus(
  startValue,
  endValue
) {

  const start =
    parseDate(startValue);

  const end =
    parseDate(endValue);

  const now =
    Date.now();

  if (!start && !end) {
    return "UNKNOWN";
  }

  if (
    start &&
    now < start.getTime()
  ) {

    return "UPCOMING";

  }

  if (
    end &&
    now > end.getTime()
  ) {

    return "ENDED";

  }

  if (
    start &&
    end &&
    now >= start.getTime() &&
    now <= end.getTime()
  ) {

    return "ACTIVE";

  }

  if (
    !start &&
    end &&
    now <= end.getTime()
  ) {

    return "ACTIVE";

  }

  if (
    start &&
    !end &&
    now >= start.getTime()
  ) {

    return "ACTIVE";

  }

  return "UNKNOWN";
}


/*
|--------------------------------------------------------------------------
| COUNTDOWN
|--------------------------------------------------------------------------
*/

function getCountdown(
  startValue,
  endValue
) {

  const start =
    parseDate(startValue);

  const end =
    parseDate(endValue);

  const now =
    Date.now();

  if (!start && !end) {

    return {
      target: null,
      milliseconds: null,
      seconds: null,
      minutes: null,
      hours: null,
      days: null
    };

  }

  let target = null;

  if (
    start &&
    now < start.getTime()
  ) {

    target = start;

  } else if (end) {

    target = end;

  }

  if (!target) {

    return {
      target: null,
      milliseconds: 0,
      seconds: 0,
      minutes: 0,
      hours: 0,
      days: 0
    };

  }

  const milliseconds =
    Math.max(
      0,
      target.getTime() - now
    );

  return {

    target:
      target.toISOString(),

    milliseconds,

    seconds:
      Math.floor(
        milliseconds / 1000
      ),

    minutes:
      Math.floor(
        milliseconds / 60000
      ),

    hours:
      Math.floor(
        milliseconds / 3600000
      ),

    days:
      Math.floor(
        milliseconds / 86400000
      )

  };
}


/*
|--------------------------------------------------------------------------
| EXTRACT EVENT ARRAY
|--------------------------------------------------------------------------
*/

function extractEvents(data) {

  if (Array.isArray(data)) {
    return data;
  }

  if (!data) {
    return [];
  }

  const possibleFields = [
    "events",
    "data",
    "results",
    "items",
    "list"
  ];

  for (
    const field of possibleFields
  ) {

    if (
      Array.isArray(
        data[field]
      )
    ) {

      return data[field];

    }

  }

  /*
   * Một số API trả:
   *
   * {
   *   data: {
   *      events: []
   *   }
   * }
   */

  if (
    data.data &&
    typeof data.data === "object"
  ) {

    for (
      const field of possibleFields
    ) {

      if (
        Array.isArray(
          data.data[field]
        )
      ) {

        return data.data[field];

      }

    }

  }

  return [];
}


/*
|--------------------------------------------------------------------------
| NORMALIZE EVENT
|--------------------------------------------------------------------------
*/

function normalizeEvent(
  raw,
  server
) {

  const id =
    firstValue(
      raw,
      [
        "id",
        "event_id",
        "eventId",
        "uuid",
        "code"
      ]
    );

  const title =
    firstValue(
      raw,
      [
        "title",
        "name",
        "event_name",
        "eventName",
        "subject"
      ]
    );

  const description =
    firstValue(
      raw,
      [
        "description",
        "desc",
        "content",
        "detail"
      ]
    );

  const banner =
    firstValue(
      raw,
      [
        "banner",
        "banner_url",
        "bannerUrl",
        "image",
        "image_url",
        "imageUrl",
        "cover",
        "cover_url"
      ]
    );

  const start =
    firstValue(
      raw,
      [
        "start_at",
        "startAt",
        "start_time",
        "startTime",
        "start",
        "from",
        "begin",
        "begin_at"
      ]
    );

  const end =
    firstValue(
      raw,
      [
        "end_at",
        "endAt",
        "end_time",
        "endTime",
        "end",
        "to",
        "finish",
        "finish_at"
      ]
    );

  const type =
    firstValue(
      raw,
      [
        "type",
        "category",
        "event_type",
        "eventType"
      ]
    ) || "event";

  const rewards =
    firstValue(
      raw,
      [
        "rewards",
        "reward",
        "prizes",
        "items"
      ]
    );

  const status =
    getStatus(
      start,
      end
    );

  return {

    id:
      id !== null
        ? String(id)
        : "",

    server,

    server_name:
      SERVERS[server]
        ? SERVERS[server].name
        : server,

    title:
      title !== null
        ? String(title)
        : "",

    description:
      description !== null
        ? String(description)
        : "",

    banner:
      banner || null,

    type:
      String(type),

    start_at:
      parseDate(start)
        ? parseDate(start).toISOString()
        : null,

    end_at:
      parseDate(end)
        ? parseDate(end).toISOString()
        : null,

    status,

    countdown:
      getCountdown(
        start,
        end
      ),

    rewards:
      Array.isArray(rewards)
        ? rewards
        : [],

    source:
      "third_party_api",

    source_url:
      UPSTREAM_URL

  };
}


/*
|--------------------------------------------------------------------------
| GET EVENTS FROM SOURCE
|--------------------------------------------------------------------------
*/

async function getSourceEvents(
  server
) {

  const url =
    buildUpstreamURL(
      server
    );

  const result =
    await fetchJSON(
      url,
      {
        headers: {
          "Accept":
            "application/json"
        }
      }
    );

  if (!result.ok) {

    throw new Error(
      `Nguồn event trả HTTP ${result.status}`
    );

  }

  const rawEvents =
    extractEvents(
      result.data
    );

  return rawEvents;

}


/*
|--------------------------------------------------------------------------
| FILTER
|--------------------------------------------------------------------------
*/

function filterEvents(
  events,
  {
    status,
    type,
    search,
    includeEnded
  }
) {

  let result =
    [...events];

  if (
    status &&
    status !== "ALL"
  ) {

    result =
      result.filter(
        event =>
          event.status === status
      );

  }

  if (
    type &&
    type !== "all"
  ) {

    result =
      result.filter(
        event =>
          String(
            event.type
          ).toLowerCase() ===
          type.toLowerCase()
      );

  }

  if (search) {

    const q =
      search.toLowerCase();

    result =
      result.filter(
        event => {

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

          return text.includes(q);

        }
      );

  }

  if (!includeEnded) {

    result =
      result.filter(
        event =>
          event.status !== "ENDED"
      );

  }

  return result;
}


/*
|--------------------------------------------------------------------------
| SORT
|--------------------------------------------------------------------------
*/

function sortEvents(
  events
) {

  const priority = {
    ACTIVE: 1,
    UPCOMING: 2,
    ENDED: 3,
    UNKNOWN: 4
  };

  return events.sort(
    (a, b) => {

      const pA =
        priority[a.status] ||
        99;

      const pB =
        priority[b.status] ||
        99;

      if (pA !== pB) {
        return pA - pB;
      }

      const aTime =
        parseDate(
          a.start_at
        )?.getTime() ||
        Number.MAX_SAFE_INTEGER;

      const bTime =
        parseDate(
          b.start_at
        )?.getTime() ||
        Number.MAX_SAFE_INTEGER;

      return aTime - bTime;

    }
  );

}


/*
|--------------------------------------------------------------------------
| HANDLER
|--------------------------------------------------------------------------
*/

module.exports =
  async function handler(
    req,
    res
  ) {

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

    if (
      req.method === "OPTIONS"
    ) {

      return res
        .status(204)
        .end();

    }

    /*
     * METHOD
     */

    if (
      req.method !== "GET"
    ) {

      return res
        .status(405)
        .json({

          success: false,

          error:
            "METHOD_NOT_ALLOWED",

          message:
            "API chỉ hỗ trợ GET."

        });

    }

    try {

      /*
       * QUERY
       */

      const server =
        String(
          req.query?.server ||
          "all"
        )
          .trim()
          .toUpperCase();

      const status =
        String(
          req.query?.status ||
          "all"
        )
          .trim()
          .toUpperCase();

      const type =
        String(
          req.query?.type ||
          "all"
        )
          .trim()
          .toLowerCase();

      const search =
        String(
          req.query?.q ||
          ""
        )
          .trim();

      const includeEnded =
        String(
          req.query?.include_ended ||
          "true"
        ).toLowerCase() !==
        "false";

      /*
       * SERVER CHECK
       */

      if (
        server !== "ALL" &&
        !SERVERS[server]
      ) {

        return res
          .status(400)
          .json({

            success: false,

            error:
              "INVALID_SERVER",

            message:
              "Server không hợp lệ.",

            available_servers:
              Object.keys(
                SERVERS
              )

          });

      }

      /*
       * STATUS CHECK
       */

      const validStatuses = [
        "ALL",
        "ACTIVE",
        "UPCOMING",
        "ENDED",
        "UNKNOWN"
      ];

      if (
        !validStatuses.includes(
          status
        )
      ) {

        return res
          .status(400)
          .json({

            success: false,

            error:
              "INVALID_STATUS",

            available_status:
              validStatuses

          });

      }

      /*
       * API KEY CHECK
       */

      if (!API_KEY) {

        return res
          .status(503)
          .json({

            success: false,

            error:
              "EVENT_SOURCE_NOT_CONFIGURED",

            message:
              "Chưa cấu hình NENCER_API_KEY trên Vercel.",

            setup: {
              variable:
                "NENCER_API_KEY"
            }

          });

      }

      /*
       * SERVERS TO FETCH
       */

      let serverList;

      if (
        server === "ALL"
      ) {

        serverList =
          Object.keys(
            SERVERS
          );

      } else {

        serverList =
          [server];

      }

      /*
       * FETCH ALL SERVERS
       */

      const serverResults =
        await Promise.allSettled(

          serverList.map(
            async currentServer => {

              const raw =
                await getSourceEvents(
                  currentServer
                );

              const events =
                raw.map(
                  event =>
                    normalizeEvent(
                      event,
                      currentServer
                    )
                );

              return {
                server:
                  currentServer,

                events
              };

            }
          )

        );

      /*
       * MERGE
       */

      const events = [];

      const errors = [];

      for (
        const result
        of serverResults
      ) {

        if (
          result.status ===
          "fulfilled"
        ) {

          events.push(
            ...result.value.events
          );

        } else {

          errors.push(
            result.reason?.message ||
            "Unknown source error"
          );

        }

      }

      /*
       * FILTER
       */

      let filtered =
        filterEvents(
          events,
          {
            status,
            type,
            search,
            includeEnded
          }
        );

      /*
       * SORT
       */

      filtered =
        sortEvents(
          filtered
        );

      /*
       * CACHE
       */

      res.setHeader(
        "Cache-Control",
        "s-maxage=60, stale-while-revalidate=300"
      );

      /*
       * RESPONSE
       */

      return res
        .status(200)
        .json({

          success: true,

          api: {

            name:
              "Free Fire Events API",

            version:
              "2.0.0",

            mode:
              "API_ONLY"

          },

          data_source: {

            provider:
              "Nencer Software",

            official_garena_api:
              false,

            note:
              "Nguồn dữ liệu bên thứ ba; không phải API công khai chính thức của Garena."

          },

          generated_at:
            new Date()
              .toISOString(),

          timezone:
            "Asia/Ho_Chi_Minh",

          request: {

            server,

            status,

            type,

            search:
              search || null,

            include_ended

          },

          servers:
            Object.fromEntries(

              Object.entries(
                SERVERS
              ).map(
                ([code, info]) => [

                  code,

                  info.name

                ]
              )

            ),

          total:
            filtered.length,

          events:
            filtered,

          source_errors:
            errors.length
              ? errors
              : []

        });

    } catch (error) {

      console.error(
        "EVENT API ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success: false,

          error:
            "EVENT_SOURCE_ERROR",

          message:
            error.message ||
            "Không thể lấy dữ liệu event."

        });

    }

  };
