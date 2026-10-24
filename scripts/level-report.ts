import { checkLevel } from '../src/levels/check';
import { levels } from '../src/levels/index';

let failed = false;
for (const level of levels) {
  const { errors, warnings, report } = checkLevel(level);
  console.log(`\n${level.id}  ${level.name}  (${level.difficulty})`);
  if (report) {
    console.log(
      `  par ${report.minChanges ?? '-'} | solution [${report.solution?.join(', ') ?? ''}]` +
        ` | par wins ${report.parWins.length} | all wins ${report.winningConfigs}/${report.reachableConfigs}` +
        ` | first-Run guess 1 in ${report.guessOdds ?? '-'}` +
        ` | idle switches [${report.idleSwitches.join(', ')}]` +
        ` | all-ON wins ${report.allOnWins ? 'yes' : 'no'} | greedy wins at par ${report.greedySolves ? 'yes' : 'no'}`,
    );
  }
  for (const w of warnings) console.log(`  warn  ${w.code}: ${w.message}`);
  for (const e of errors) console.log(`  ERROR ${e.code}: ${e.message}`);
  if (errors.length > 0) failed = true;
}
process.exit(failed ? 1 : 0);
