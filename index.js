#!/usr/bin/env node

import chalk from 'chalk'
import {checkbox, confirm, select} from '@inquirer/prompts'
import {execFileSync} from 'node:child_process'

// ================================== CLI ====================================

const command = process.argv[2]

switch (command) {
  case 's':
  case 'switch':
    run(switchBranch)
    break
  case 'd':
  case 'delete':
    run(deleteBranches.bind(null, selectBranchesToDelete))
    break
  case 'dm':
  case 'delete-merged':
    run(deleteBranches.bind(null, getMergedBranches))
    break
  case 'help':
  case '-h':
  case '--help':
    console.error('Usage: b <command>\n\n' +
                  '  s, switch: Switch branch\n' +
                  '  d, delete: Delete branches\n' +
                  '  delete-merged: Delete merged branches')
    break
  case undefined:
    run(printStatus)
    break
  default:
    console.error(`Unrecognized command: ${command}`)
    process.exit(1)
}

// ============================ Command handlers  ============================

async function run(task) {
  try {
    await task()
  } catch (error) {
    if (error.name != 'ExitPromptError') {
      throw error
    }
  }
}

async function switchBranch() {
  const {current, all} = getBranches((a, b) => compareDate(b, a))

  if (all.length == 1 && all[0].value == current) {
    console.log('Current branch is the only branch:', chalk.cyan(current))
    process.exit(0)
  }

  const chosen = await select({
    message: 'Select a branch to checkout:',
    default: current,
    choices: all,
  })

  if (chosen == current) {
    console.error(chalk.blue('Stay on current branch'))
    process.exit(0)
  }

  git('checkout', chosen)
}

async function deleteBranches(selectBranches) {
  const chosen = await selectBranches()
  if (chosen.length == 0) {
    console.error(chalk.blue('No branch is deleted.'))
    process.exit(0)
  }

  console.log(chalk.red.bold.underline('Following branches are going to be deleted:'))
  console.log(chosen.map((b, i) => `  ${i + 1}. ${b}`).join('\n'))

  const yes = await confirm({
    message: `Delete ${chosen.length} branches?`,
    default: true,
  })

  if (yes) {
    git('branch', '-D', ...chosen)
    console.log(chalk.blue('All selected branches deleted.'));
  }
}

async function printStatus() {
  const {current, all} = getBranches()
  const branches = all.map(b => {
    if (b.value == current) {
      return chalk.cyan(b.value)
    } else {
      return b.value
    }
  })
  console.log(chalk.bold('Branches:'), ...branches)

  const cmds = [
    [ 'Cached', [ 'diff', '--color=always', '--cached' ] ],
    [ 'Modified', [ 'diff', '--color=always' ] ],
  ]
  const minus = chalk.red('-').slice(0, -5)
  const plus = chalk.green('+').slice(0, -5)

  for (const [title, args] of cmds) {
    const stats = git(...args, '--compact-summary')
    if (stats.length == 0)
      continue
    console.log('')
    console.log(chalk.bold(`${title} files:`))

    const lines = stats.split('\n').slice(0, -1)
    for (const summary of lines) {
      console.log(summary)
      if (lines.length <= 4) {
        const [file, changes] = summary.split('|')
        const count = parseInt(changes.split(' ').at(-2))
        if (count <= 4) {
          const diff = git(...args, '--unified=0', file.trim())
          for (const line of diff.split('\n')) {
            if (line.startsWith(minus) || line.startsWith(plus)) {
              console.log('  ', line)
            }
          }
        }
      }
    }
  }
}

// ================================== Utils  =================================

function getBranches(compare = (a, b) => compareDate(a, b)) {
  const branches = git('for-each-ref',
                       'refs/heads/',
                       '--sort=committerdate',
                       '--format="%(HEAD)#%(refname:short)#%(committerdate:relative)#%(committerdate:iso8601)"')
  if (!branches) {
    console.error('There is no branches.')
    process.exit(1)
  }

  const current = branches.match(/\*#(.+)#/)?.at(1).split('#').at(0)

  const all = branches.split('\n')
                      .sort((a, b) => compare(a[3], b[3]))
                      .map(parseBranch)

  return {current, all}
}

function parseBranch(line) {
  const columns = line.split('#')
  return {
    name: columns[1] + chalk.dim(` (${columns[2]})`),
    value: columns[1],
    short: columns[1],
  }
}

async function selectBranchesToDelete() {
  const {current, all} = getBranches()

  const deletable = all.filter(b => b.value != current)
  if (deletable.length == 0) {
    console.log('Current branch is the only branch:', chalk.cyan(current))
    process.exit(0)
  }

  const chosen = await checkbox({
    message: 'Select branches to delete:',
    choices: deletable,
    theme: {helpMode: 'never'},
  })

  return chosen
}

function getMergedBranches() {
  const merged = git('branch', '--merged')
      .split('\n')
      .filter(b => !b.startsWith('*'))
      .filter(b => b != 'main' && b != 'master')
      .map(b => b.trim())
      .concat(getSquashMergedBranches())
  return [ ...(new Set(merged)) ]
}

function getSquashMergedBranches() {
  const stdout = git('for-each-ref',
                     'refs/heads/',
                     '--format=%(refname:short)')
  if (!stdout) {
    return []
  }
  const branches = stdout.split('\n')

  let main
  for (const b of ['main', 'master']) {
    if (branches.includes(b)) {
      main = b
      break
    }
  }
  if (!main) {
    console.error('There is no main branch.')
    process.exit(1)
  }

  const merged = []
  for (const branch of branches) {
    if (branch == main)
      continue
    const ancestor = git('merge-base', main, branch)
    const tree = git('rev-parse', `${branch}^{tree}`)
    const commit = git('commit-tree', tree, '-p', ancestor, '-m', 'TMP')
    const cherry = git('cherry', main, commit)
    if (cherry.startsWith('-'))
      merged.push(branch)
  }

  return merged
}

function git(...args) {
  return String(execFileSync('git', args)).trimRight()
}

function compareDate(a, b) {
  return new Date(a) - new Date(b)
}
