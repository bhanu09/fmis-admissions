export const defaultTeams = [
  {id: 'a', name: 'Team A', hard: 16, soft: null, difference: 4},
  {id: 'b', name: 'Team B', hard: null, soft: 14, difference: 3},
];

export function planAssignments(teams, counts, previous) {
  const order = [teams.find(team => team.id === previous), ...teams.filter(team => team.id !== previous)];
  const census = {...counts};

  const overBudget = new Set();
  const assignments = Array.from({length: 4}, () => {
    const eligible = order.filter(team => {
      if (team.hard === null || census[team.id] < team.hard) return true;
      overBudget.add(team.id);
      return false;
    });
    const preferred = eligible.find(team => {
      const lowestOther = Math.min(...teams.filter(other => other.id !== team.id).map(other => census[other.id]));
      return (team.soft === null || census[team.id] < team.soft)
        && (team.difference === null || census[team.id] + 1 - lowestOther <= team.difference);
    });
    const selected = preferred ?? eligible.reduce((lowest, team) =>
      !lowest || census[team.id] < census[lowest.id] ? team : lowest, null);
    if (!selected) return null;
    census[selected.id]++;
    return selected.id;
  });
  return {assignments, overBudget};
}
