'use strict';

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getDhakaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour) };
}

function getDhakaDateKey(date = new Date(), dayOffset = 0) {
  const { year, month, day } = getDhakaParts(date);
  const shifted = new Date(Date.UTC(year, month - 1, day) + dayOffset * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

function getDhakaDayBounds(dateOrKey = new Date()) {
  const dateKey = typeof dateOrKey === 'string' ? dateOrKey : getDhakaDateKey(dateOrKey);
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - DHAKA_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS), dateKey };
}

function getDhakaYear(date = new Date()) {
  return getDhakaParts(date).year;
}

module.exports = { getDhakaParts, getDhakaDateKey, getDhakaDayBounds, getDhakaYear };
