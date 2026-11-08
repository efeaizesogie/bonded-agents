// Print the live facts an agent would gather for a task.
//   npm run facts -- token DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
import "dotenv/config";
import { gatherFacts } from "../src/lib/facts";
import type { TaskKind } from "../src/lib/tasks";

const [kind, input] = process.argv.slice(2);
const f = await gatherFacts(kind as TaskKind, input);
console.log(JSON.stringify(f.checks, null, 1));
console.log(f.context.slice(0, 2500));
