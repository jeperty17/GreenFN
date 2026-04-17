const TIME_ZONE = "Asia/Singapore";

function getDateKeyInTimeZone(date, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function getSingaporeTodayDateKey(now = new Date()) {
  return getDateKeyInTimeZone(now);
}

function getSingaporeDayBounds(now = new Date()) {
  const dayKey = getSingaporeTodayDateKey(now);
  const start = new Date(`${dayKey}T00:00:00+08:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

module.exports = {
  TIME_ZONE,
  getDateKeyInTimeZone,
  getSingaporeTodayDateKey,
  getSingaporeDayBounds,
};
