import {defaultTeams, planAssignments} from './rules.mjs';

const byId = id => document.getElementById(id);
const storageKey = 'overnight-admissions-teams-v1';
let teams = structuredClone(defaultTeams);
let draft;
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) teams = JSON.parse(saved);
} catch {
  // The planner remains usable when browser storage is unavailable.
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function field(label, name, value, type, required = false) {
  const wrapper = element('label', label, 'field');
  const input = element('input');
  input.name = name;
  input.type = type;
  input.value = value ?? '';
  input.required = required;
  if (type === 'number') {
    input.min = '0';
    input.max = String(Number.MAX_SAFE_INTEGER - 4);
    input.step = '1';
    if (!required) input.placeholder = 'None';
  } else {
    input.maxLength = 60;
  }
  wrapper.append(input);
  return wrapper;
}

function censusValues() {
  return Object.fromEntries([...byId('counts').querySelectorAll('input')].map(input => [input.name, input.value]));
}

function displayResults({assignments, overBudget} = {}) {
  const rows = Array.from({length: 4}, (_, index) => {
    const row = element('div', undefined, 'assignment');
    const team = assignments && teams.find(item => item.id === assignments[index]);
    row.append(element('span', 'Patient ' + (index + 1)));
    row.append(element('strong', team?.name ?? (assignments ? 'Unassigned · Hard caps reached' : 'Pending calculation'),
      team ? '' : assignments ? 'blocked' : 'waiting'));
    return row;
  });
  if (overBudget?.size) {
    const notice = element('div', undefined, 'capacity-notice');
    const names = new Intl.ListFormat().format(teams.filter(team => overBudget.has(team.id)).map(team => team.name));
    const verb = overBudget.size === 1 ? 'would be' : 'would each be';
    notice.append(element('strong', 'Backup may be needed'));
    notice.append(element('p', names + ' ' + verb + ' over budget with another admission. Consider requesting backup.'));
    rows.push(notice);
  }
  byId('results').replaceChildren(...rows);
}

function renderPlanner(counts = {}, previous = '') {
  byId('team-total').textContent = teams.length + ' teams';
  byId('counts').replaceChildren(...teams.map(team => field(team.name + ' count', team.id, counts[team.id], 'number', true)));
  const placeholder = element('option', 'Select a team');
  placeholder.value = '';
  placeholder.disabled = true;
  byId('oncall').replaceChildren(placeholder, ...teams.map(team => {
    const option = element('option', team.name);
    option.value = team.id;
    return option;
  }));
  byId('oncall').value = teams.some(team => team.id === previous) ? previous : '';
  displayResults();
}

function readDraft() {
  return [...byId('teams').children].map((row, index) => {
    const readNumber = name => {
      const input = row.querySelector('[name="' + name + '"]');
      return input.validity.badInput ? NaN : input.value === '' ? null : input.valueAsNumber;
    };
    return {
      id: draft[index].id,
      name: row.querySelector('[name="name"]').value.trim(),
      hard: readNumber('hard'),
      soft: readNumber('soft'),
      difference: readNumber('difference'),
    };
  });
}

function renderSettings() {
  byId('teams').replaceChildren(...draft.map((team, index) => {
    const row = element('div', undefined, 'team-row');
    const remove = element('button', 'Remove');
    remove.type = 'button';
    remove.disabled = draft.length <= 2;
    remove.setAttribute('aria-label', 'Remove ' + (team.name || 'team ' + (index + 1)));
    remove.onclick = () => {
      if (!byId('teams-form').reportValidity()) return;
      draft = readDraft();
      draft.splice(index, 1);
      renderSettings();
    };
    row.append(field('Team name', 'name', team.name, 'text', true),
      field('Hard cap', 'hard', team.hard, 'number'),
      field('Soft cap', 'soft', team.soft, 'number'),
      field('Max difference', 'difference', team.difference, 'number'), remove);
    return row;
  }));
  byId('settings-status').textContent = '';
}

byId('planner').addEventListener('submit', event => {
  event.preventDefault();
  const counts = Object.fromEntries(Object.entries(censusValues()).map(([id, value]) => [id, Number(value)]));
  displayResults(planAssignments(teams, counts, byId('oncall').value));
});
byId('planner').addEventListener('input', () => displayResults());
byId('reset').onclick = () => renderPlanner();
byId('defaults').onclick = () => {
  draft = structuredClone(defaultTeams);
  renderSettings();
  byId('settings-status').textContent = 'Defaults loaded. Save settings to apply them.';
};
byId('add').onclick = () => {
  if (!byId('teams-form').reportValidity()) return;
  draft = readDraft();
  const names = new Set(draft.map(team => team.name.toLowerCase()));
  let index = 2;
  let name;
  do {
    name = 'Team ' + (index < 26 ? String.fromCharCode(65 + index) : index + 1);
    index++;
  } while (names.has(name.toLowerCase()));
  draft.push({id: crypto.randomUUID(), name, hard: null, soft: null, difference: null});
  renderSettings();
  byId('teams').lastElementChild.querySelector('input').focus();
};
byId('teams-form').addEventListener('submit', event => {
  event.preventDefault();
  const updated = readDraft();
  const names = updated.map(team => team.name.toLowerCase());
  if (names.some(name => !name) || new Set(names).size !== names.length) {
    byId('settings-status').textContent = 'Enter a unique name for each team.';
    return;
  }

  const counts = censusValues();
  const previous = byId('oncall').value;
  let message = 'Team settings saved.';
  try {
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch {
    message = 'Settings applied for this session. Browser storage is unavailable.';
  }
  teams = updated;
  draft = structuredClone(teams);
  renderPlanner(counts, previous);
  renderSettings();
  byId('settings-status').textContent = message;
});

draft = structuredClone(teams);
renderPlanner();
renderSettings();
