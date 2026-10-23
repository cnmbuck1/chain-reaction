import { checkLevel } from '../src/levels/check';
import { levels } from '../src/levels/index';

let failed = false;
for (const level of levels) {
  const { errors, warnings, report } = checkLevel(level);
  console.log(`\n${level.id}  ${level.name}  (${level.difficulty}, budget ${level.maxToggles})`);
  if (report) {
    console.log(
      `  min changes ${report.minChanges ?? '-'} | solution [${report.solution?.join(', ') ?? ''}]` +
        ` | winning ${report.winningConfigs}/${report.reachableConfigs} reachable` +
        ` | all-ON wins ${report.allOnWins ? 'yes' : 'no'} | greedy wins ${report.greedySolves ? 'yes' : 'no'}`,
    );
  }
  for (const w of warnings) console.log(`  warn  ${w.code}: ${w.message}`);
  for (const e of errors) console.log(`  ERROR ${e.code}: ${e.message}`);
  if (errors.length > 0) failed = true;
}
process.exit(failed ? 1 : 0);
