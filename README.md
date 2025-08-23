# b-is-branch

CLI tool for switching/deleting git branches.

## Install

```console
$ npm install -g b-is-branch
```

## Usage

Show help:

```console
$ b help
Usage: b <command>

  s, switch: Switch branch
  d, delete: Delete branches
  delete-merged: Delete merged branches
```

Show current status:

```console
$ b
Branches: main test1 test2

Modified files:
 mlx/backend/cuda/cudnn_utils.h | 19 +++++++++++++------
 mlx/backend/cuda/device.cpp    | 14 +-------------
```

Switch between branches:

```console
$ b s
? Select a branch to checkout: (Use arrow keys)
❯ main (3 days ago)
  test1 (3 days ago)
  test2 (3 days ago)
✔ Select a branch to checkout: test1
Switched to branch 'test1'
```

Delete selected branches:

```console
$ b d
? Select branches to delete:
❯◯ main (3 days ago)
 ◯ test2 (3 days ago)
✔ Select branches to delete: main, test2
Following branches are going to be deleted:
  1. main
  2. test2
? Delete 2 branches? (Y/n) Yes
All selected branches deleted.
```

Delete merged branches:

```console
$ b delete-merged
Following branches are going to be deleted:
  1. test1
  2. test2
? Delete 2 branches? (Y/n)
```

## License

Code are released under public domain
