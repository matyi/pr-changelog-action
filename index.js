const core = require('@actions/core');
const github = require('@actions/github');

const bumpVersion = (changelog, oldVersion) => {
  const version = oldVersion.split('.');
  let versionBump;
  const section_mapping = core.getInput('section_mapping').split(',');
  core.info(`Section mapping: ${section_mapping}`);
  section_mapping.some((mapping) => {
    const [section, bump] = mapping.split('=>').map(e => e.trim());
    if (changelog.search(section) >= 0) {
      core.info(`${section} found`);
      if (bump === 'minor') {
        versionBump = bump;
        return true;
      }
      versionBump = bump;
    }
  });
  switch (versionBump) {
    case 'minor':
      version[1] = Number(version[1]) + 1;
      version[2] = 0;
      break;
    case 'patch':
      version[2] = Number(version[2]) + 1;
      break;
  }
  return version.join('.');
}

const run = async () => {
  try {
    const githubToken = core.getInput('github_token', { required: true });
    const octokit = github.getOctokit(githubToken);

    const credentials = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    };
    const pullRequest = github.context.payload.pull_request;

    const { data: { tag_name } } = await octokit.rest.repos.getLatestRelease(credentials);
    core.info(`latest release: ${tag_name}`);

    const searchWord = '```changelog';
    const startIndex = pullRequest.body.search(searchWord) + searchWord.length;
    let changelog = pullRequest.body.slice(startIndex);
    const endIndex = changelog.search('```');
    changelog = changelog.slice(0, endIndex);

    if (!changelog.trim()) throw 'No changelog found';
    
    const oldVersion = (tag_name || core.getInput('initial_version'));
    const newVersion = bumpVersion(changelog, oldVersion);
    
    core.info(`version: ${oldVersion} => ${newVersion}`);

    if (oldVersion === newVersion) throw 'No version change';
    
    core.setOutput('changelog', changelog);
    core.setOutput('version', newVersion);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
