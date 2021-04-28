const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const { which } = require("@actions/io");

function getCWD() {
  const { GITHUB_WORKSPACE = ".", SOURCE = "." } = process.env;
  return `${GITHUB_WORKSPACE}/${SOURCE}`;
}

const main = async () => {
  try {
    // `who-to-greet` input defined in action metadata file
    const nameToGreet = core.getInput("who-to-greet");
    console.log(`Hello ${nameToGreet}!`);
    const time = new Date().toTimeString();
    core.setOutput("time", time);
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2);
    const commitsToCheck = github.context.payload.commits.map(
      (commit) => commit.id
    );
    console.log("Commits to check", commitsToCheck);

    const lastCommit = commitsToCheck[commitsToCheck.length - 1];
    const previousCommit = github.context.payload.before;

    const paths = ["a/", "b/"];

    for (const path of paths) {
      const exitCode = await exec.exec(
        "git",
        ["diff", "--quiet", previousCommit, lastCommit, "--", path],
        {
          ignoreReturnCode: true,
          silent: false,
          cwd: getCWD(),
        }
      );
      console.log(
        "Difference for path",
        path,
        exitCode === 1,
        "ended diff in",
        exitCode
      );

      if (exitCode === 1) {
        const testResult = await exec.exec(
          await which("npm", true),
          ["run", "test"],
          {
            ignoreReturnCode: true,
            cwd: getCWD() + path,
          }
        );
        console.log(testResult);
      }
    }

    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
