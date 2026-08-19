// HUD: leaderboard, health, timer, fps, killfeed, item-icoon en aankondigingen.

import { MAX_HP } from './util.js';
import { WEAPONS } from './items.js';

const el = {};

export function initHud() {
  for (const id of [
    'leaderboard', 'healthfill', 'timer', 'fps', 'killfeed',
    'announce', 'itemicon', 'overlay', 'startpanel', 'endpanel',
    'endboard', 'endtitle',
  ]) el[id] = document.getElementById(id);
}

const MEDALS = ['#f7b32b', '#b9c4d0', '#c98d5a']; // goud, zilver, brons

export function updateLeaderboard(karts, me) {
  const sorted = [...karts].sort((a, b) => b.score - a.score || a.deaths - b.deaths);
  let html = '';
  sorted.slice(0, 8).forEach((k, i) => {
    const rankBg = i < 3 ? MEDALS[i] : '#1466b8';
    html += `<div class="lb-row${k === me ? ' me' : ''}${k.dead ? ' dead' : ''}">
      <span class="lb-rank" style="background:${rankBg}">${i + 1}</span>
      <span class="lb-name">${escapeHtml(k.name)}</span>
      <span class="lb-score">${k.score}</span>
    </div>`;
  });
  el.leaderboard.innerHTML = html;
  return sorted;
}

export function updateHealth(me) {
  el.healthfill.style.width = `${(me.hp / MAX_HP) * 100}%`;
}

export function updateTimer(seconds) {
  el.timer.textContent = Math.max(0, Math.ceil(seconds));
}

export function updateFps(fps) {
  el.fps.textContent = `FPS: ${Math.round(fps)}`;
}

export function updateItemIcon(me) {
  if (me.weapon) {
    const cfg = WEAPONS[me.weapon.type];
    el.itemicon.textContent = cfg.icon;
  } else {
    el.itemicon.textContent = '';
  }
}

const KILL_ICONS = { gun: '\u{1F52B}', rocket: '\u{1F680}', mine: '\u{1F4A3}' };

export function addKillFeed(victim, killer, weaponType) {
  const div = document.createElement('div');
  div.className = 'kf';
  const icon = KILL_ICONS[weaponType] || '\u{1F4A5}';
  if (killer && killer !== victim) {
    div.innerHTML = `<b>${escapeHtml(killer.name)}</b> ${icon} ${escapeHtml(victim.name)}`;
  } else {
    div.innerHTML = `${icon} ${escapeHtml(victim.name)}`;
  }
  el.killfeed.appendChild(div);
  while (el.killfeed.children.length > 4) el.killfeed.firstChild.remove();
  setTimeout(() => div.remove(), 4000);
}

let announceTimeout = null;
export function announce(text, ms = 1200) {
  el.announce.textContent = text;
  el.announce.style.opacity = '1';
  clearTimeout(announceTimeout);
  announceTimeout = setTimeout(() => { el.announce.style.opacity = '0'; }, ms);
}

export function showEnd(sorted, me) {
  el.overlay.classList.remove('hidden');
  el.startpanel.classList.add('hidden');
  el.endpanel.classList.remove('hidden');
  const rank = sorted.indexOf(me) + 1;
  el.endtitle.textContent = rank === 1 ? '\u{1F3C6} GEWONNEN!' : `${rank}e PLAATS`;
  let html = '';
  sorted.forEach((k, i) => {
    html += `<div class="eb-row${k === me ? ' me' : ''}">
      <span class="r">${i + 1}.</span>
      <span class="n">${escapeHtml(k.name)}</span>
      <span>${k.score}</span>
    </div>`;
  });
  el.endboard.innerHTML = html;
}

export function hideOverlay() {
  el.overlay.classList.add('hidden');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
