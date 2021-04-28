const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");

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

    //  --quiet: exits with 1 if there were differences (https://git-scm.com/docs/git-diff)
    for await (const commitId of commitsToCheck) {
      const exitCode = await exec.exec(
        "git",
        ["diff", "--quiet", commitId, "--", "a/"],
        {
          ignoreReturnCode: true,
          silent: false,
          cwd: getCWD(),
        }
      );
      console.log("Commit", commitId, "ended diff in", exitCode);
    }

    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
