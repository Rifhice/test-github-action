const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const fs = require("fs");

function getCWD() {
  const { GITHUB_WORKSPACE = ".", SOURCE = "." } = process.env;
  return `${GITHUB_WORKSPACE}/${SOURCE}`;
}

const execute = (command, args, options = {}) => {
  let myOutput = "";
  return new Promise((resolve) => {
    exec
      .exec(command, args, {
        ...options,
        listeners: {
          stdout: (data) => (myOutput += data.toString()),
        },
      })
      .then(() => resolve(myOutput));
  });
};

const wasChanged = async ({ path, commit }) => {
  const exitCode = await exec.exec(
    "git",
    [
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      "--quiet",
      commit,
      path,
    ],
    {
      ignoreReturnCode: true,
      silent: true,
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

const extractBranchNameFromCommitMessage = (name) => {
  const result = name.match(/\[(.*?)\]/);
  return result !== null ? result[1] : undefined;
};

const main = async () => {
  try {
    const payload = JSON.stringify(github.context.payload, undefined, 2);

    const file = await new Promise((resolve) =>
      fs.readFile("elise.json", (err, data) => resolve(data && data.toString()))
    );

    console.log(file);

    const commitsToCheck = github.context.payload.commits.map((commit) => ({
      branchName: extractBranchNameFromCommitMessage(commit.message),
      id: commit.id,
    }));

    console.log("Commits to check", commitsToCheck);

    const branchesToCheck = [
      ...new Set(
        commitsToCheck
          .map((commit) => commit.branchName)
          .filter((branchName) => branchName)
      ),
    ];

    const separator = "#separator#";

    const rawLast100Commits = await execute(
      "git",
      ["log", `--format=%H${separator}%s`, "-n 100"],
      {
        cwd: getCWD(),
        silent: true,
      }
    );
    const last100Commits = rawLast100Commits
      .split("\n")
      .filter((line) => !!line.trim())
      .map((commit) => {
        const [id, name] = commit.split(separator);
        return {
          branchName: extractBranchNameFromCommitMessage(name),
          id,
        };
      });
    console.log("Last", last100Commits.length, "commits", last100Commits);

    const commitsToCheckPerBranch = branchesToCheck.reduce((acc, branch) => {
      return {
        ...acc,
        [branch]: last100Commits.filter(
          (commit) => commit.branchName && commit.branchName === branch
        ),
      };
    }, {});

    commitsToCheckPerBranch["no-branch-related"] = commitsToCheck.filter(
      (commit) => !commit.branchName
    );

    console.log("Commits to check per branch", commitsToCheckPerBranch);

    const changedServices = [];
    for (const service of services) {
      const { path } = service;
      const commits = Object.values(commitsToCheckPerBranch).flat(1);
      for (const commit of commits) {
        const pathWasChanged = await wasChanged({
          path,
          commit: commit.id,
        });
        console.log("Was path", path, "changed", pathWasChanged);

        if (pathWasChanged && !changedServices.includes(service))
          changedServices.push(service);
      }
    }

    console.log("Services to check", changedServices);

    // Test all changed services
    // Deploy all changed services to heroku
    // In case of failure in a deployment, revert the other services

    // const testResult = await exec.exec(
    //   await which("npm", true),
    //   ["run", "test"],
    //   {
    //     cwd: getCWD() + "/" + path,
    //   }
    // );
    // console.log(testResult);

    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
