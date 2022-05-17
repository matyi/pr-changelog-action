# PR Changelog GitHub action

Github action to read changelog from PR description and give a new version.

This Action doesn't make any changes just gives you back some output.
You can use it to just check if the PR contains the proper changelog or to bump version and create a new release based on it's outputs.

**Attention**

Make sure you use the `actions/checkout@v2` action!

### Workflow

* Based on the PR description, increment the version from the latest release.
* Push the bumped npm version in package.json and package-lock.json back into the repo.
* Create a new release with the new version number and the changelog.

### Inputs
- github_token:
  - description: 'The GITHUB_TOKEN secret'
  - required: true  
- destination_branch:
  - description: 'Base branch of the PR. Default is master'
  - default: master
- section_mapping:
  - description: 'Section mapping to bump versions'
  - default: '### Feature => minor, ### Breaking change => minor, ### Bug fix => patch, ### Chore => patch'
  - comma separated list of 'title => [minor, patch]'
- initial_version:
  - description: 'Version number to use if no previous releases found'
  - default: '0.0.0' (it will bump to 0.0.1 on first run)

### Outputs
- changelog:
  - description: 'Changelog from PR description'
- version:
  - description: 'Version bump generated from PR description'

### Usage:
To check the PR description:
```yaml
name: PR Check
on:
  pull_request:
    types: [ opened, edited ]

jobs:
  check:
    name: PR Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Read PR description
        uses: matyi/pr-changelog-action@v1
        id: pr-changelog
        with:
          GITHUB_TOKEN: ${{ secrets.github_token }}
          destination_branch: master
```
To bump package.json and create a new release when merging a PR:
```yaml
name: Create new release
on:
  pull_request:
    branches:
      - develop
    types: [ closed ]

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Read PR description
        uses: matyi/pr-changelog-action@v1
        id: pr-changelog
        with:
          GITHUB_TOKEN: ${{ secrets.github_token }}
          destination_branch: develop
      - run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
      - run: "npm version ${{ steps.pr-changelog.outputs.version }} -m 'Chore: bump version to ${{ steps.pr-changelog.outputs.version }}'"
      - run: git push
      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.github_token }}
        with:
          tag_name: ${{ steps.pr-changelog.outputs.version }}
          release_name: ${{ steps.pr-changelog.outputs.version }}
          body: ${{ steps.pr-changelog.outputs.changelog }}
```

Example PR description template:
~~~markdown
Write here your PR description.

...

## Changelog
```changelog
### Bug fix
- list your bug fixes

### Feature
- list new features

### Chore
- list chores

### Breaking change
- list breaking changes
```
_(Remove sections if there's no that type of change in your PR)_

## Jira ticket or any other sections
...

## Screenshots
...
~~~