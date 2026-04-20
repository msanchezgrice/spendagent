import chalk from "chalk";

let verbose = false;

export function setVerbose(v: boolean) {
  verbose = v;
}

export const log = {
  info: (msg: string) => console.log(msg),
  step: (msg: string) => console.log(chalk.cyan("›"), msg),
  ok: (msg: string) => console.log(chalk.green("✓"), msg),
  warn: (msg: string) => console.log(chalk.yellow("!"), msg),
  error: (msg: string) => console.error(chalk.red("✗"), msg),
  debug: (msg: string) => {
    if (verbose) console.log(chalk.gray("·"), chalk.gray(msg));
  },
  raw: (msg: string) => console.log(msg),
  bold: (msg: string) => console.log(chalk.bold(msg)),
  dim: (msg: string) => console.log(chalk.dim(msg)),
};
