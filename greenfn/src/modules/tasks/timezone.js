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

module.exports = {
  TIME_ZONE,
  getDateKeyInTimeZone,
  getSingaporeTodayDateKey,
};
