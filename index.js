const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const { which } = require("@actions/io");

function getCWD() {
  const { GITHUB_WORKSPACE = ".", SOURCE = "." } = process.env;
  return `${GITHUB_WORKSPACE}/${SOURCE}`;
}

const wasChanged = async ({ path, firstCommit, lastCommit }) => {
  const exitCode = await exec.exec(
    "git",
    ["diff", "--quiet", firstCommit, lastCommit, "--", path],
    {
      ignoreReturnCode: true,
      silent: false,
      cwd: getCWD(),
    }
  );
  return exitCode === 1;
};

const services = [
  {
    path: "a/",
  },
  {
    path: "b/",
  },
];

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

    const commitMessage = await exec.exec(
      "git",
      ["log", "--format=%B", "-n 1", lastCommit],
      {
        cwd: getCWD(),
      }
    );
    console.log("Commit message", commitMessage);

    const changedServices = [];
    for (const service of services) {
      const { path } = service;
      const pathWasChanged = await wasChanged({
        path,
        firstCommit: previousCommit,
        lastCommit,
      });
      console.log("Was path", path, "changed", pathWasChanged);

      if (pathWasChanged) changedServices.push(service);
    }

    // Test all changed services
    // Deploy all changed services to heroku
    // In case of failure in a deployment, revert the other services

    const testResult = await exec.exec(
      await which("npm", true),
      ["run", "test"],
      {
        cwd: getCWD() + "/" + path,
      }
    );
    console.log(testResult);

    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
