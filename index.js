const core = require('@actions/core');
const github = require('@actions/github');

const bumpVersion = (changelog, oldVersion) => {
  const version = oldVersion.split('.');
  const section_mapping = core.getInput('section_mapping').split(',');
  core.info(`Section mapping: ${section_mapping}`);
  section_mapping.some((mapping) => {
    const [section, bump] = mapping.split('=>').map(e => e.trim());
    if (changelog.search(section) >= 0) {
      core.info(`${section} found`);
      switch (bump) {
        case 'minor':
          version[1] = Number(version[1]) + 1;
          version[2] = 0;
          return true;
        case 'patch':
          version[2] = Number(version[2]) + 1;
          return true;
      }
    }
  });
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

    let pullRequest;

    if (github.context.payload.pull_request) {
      const baseBranch = core.getInput('destination_branch');
      const sourceBranch = github.context.payload.pull_request.head.ref.replace(/^refs\/heads\//, '');
      core.info(`Looking up a pull request with a source branch "${sourceBranch || '<not found>'}" and a base branch "${baseBranch || '<not specified>'}"`);

      const branchHead = `${credentials.owner}:${sourceBranch}`;
      const { data: pulls } = await octokit.rest.pulls.list({
        ...credentials,
        base: baseBranch,
        head: branchHead,
        sort: 'updated',
        direction: 'desc',
        state: 'all'
      });
  
      if (pulls.length === 0) {
        throw new Error(`No pull request found for a source branch "${sourceBranch || '<not found>'}" and a base branch "${baseBranch || '<not specified>'}"`);
      }
  
      pullRequest = pulls[0];
      if (pullRequest == null) {
        throw new Error(`No open pull requests found for a source branch "${sourceBranch || '<not found>'}" and a base branch "${baseBranch || '<not specified>'}"`);
      }
    } else {
      const resp = await octokit.rest.pulls.list({
        ...credentials,
        sort: 'updated',
        direction: 'desc',
        state: 'closed',
        per_page: 100
      });

      pullRequest = resp.data.find(p => p.merge_commit_sha === github.context.sha);
    }

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
