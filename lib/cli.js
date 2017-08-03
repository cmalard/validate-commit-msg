#!/usr/bin/env node

/**
 * Git COMMIT-MSG hook for validating commit message
 * See https://docs.google.com/document/d/1rk04jEuGfk9kYzfqCuOlPTSJw3hEDZJTBN5E5f1SALo/edit
 *
 * This CLI supports 3 usage ways:
 * 1. Default usage is not passing any argument. It will automatically read from COMMIT_EDITMSG file.
 * 2. Passing a file name argument from git directory. For instance GIT GUI stores commit msg @GITGUI_EDITMSG file.
 * 3. Passing commit message as argument. Useful for testing quickly a commit message from CLI.
 *
 * Installation:
 * >> cd <angular-repo>
 * >> ln -s ../../validate-commit-msg.js .git/hooks/commit-msg
 */

'use strict';

var fs = require('fs');
var gitRawCommits = require('git-raw-commits');
var path = require('path');
var program = require('commander');

var getGitFolder = require('./getGitFolder');
var recover = require('./recover');
var validateMessage = require('../index');

var commitErrorLogPath;
var commitMsgFileOrText;


program
  .option('--from <branch/tag/commit>', 'Specify a source. ex: --from=develop')
  .option('--recover', 'Pre-fill commit message if it previously failed. To use in prepare-commit-msg hook.')
  .arguments('[msgFileOrText] [errorLogPath]')
  .action(function (msgFileOrText, errorLogPath) {
    commitMsgFileOrText = msgFileOrText;
    commitErrorLogPath = errorLogPath;
  })
  .parse(process.argv);


// On running the validation over a text instead of git files such as COMMIT_EDITMSG and GITGUI_EDITMSG
// is possible to be doing that the from anywhere. Therefore the git directory might not be available.
var COMMIT_EDITMSG_ERR;
var gitDirectory;
try {
  gitDirectory = getGitFolder();

  if (!commitErrorLogPath) {
    commitErrorLogPath = path.resolve(gitDirectory, 'logs/incorrect-commit-msgs');
  }

  COMMIT_EDITMSG_ERR = path.resolve(gitDirectory, 'COMMIT_EDITMSG_ERR')
} catch (err) {}


var bufferToString = function (buffer) {
  var hasToString = buffer && typeof buffer.toString === 'function';

  return hasToString && buffer.toString();
}

var getCommit = function (msgFileOrText) {
  if (msgFileOrText !== undefined) {
    return getCommitFromFile(msgFileOrText) || { message: msgFileOrText };
  }

  return getCommitFromFile('COMMIT_EDITMSG') || { message: null };
}

var getCommitFromFile = function (file) {
  if (!gitDirectory || !file) {
    return null;
  }

  file = path.resolve(gitDirectory, file);
  var message = getFileContent(file);

  return (!message) ? null : {
    message: message,
    sourceFile: file
  };
}

var getFileContent = function (filePath) {
  try {
    var buffer = fs.readFileSync(filePath);

    return bufferToString(buffer);
  } catch (err) {
    // Ignore these error types because it is most likely validating
    // a commit from a text instead of a file
    if (err && err.code !== 'ENOENT' && err.code !== 'ENAMETOOLONG') {
      throw err;
    }
  }
}

var saveError = function (message) {
  if (program.from) {
    return;
  }

  if (commitErrorLogPath) {
    fs.appendFileSync(commitErrorLogPath, message + '\n');
  }

  if (COMMIT_EDITMSG_ERR) {
    fs.writeFileSync(COMMIT_EDITMSG_ERR, message);
  }
}

function validate(message, sourceFile) {
  if (!validateMessage(message, sourceFile)) {
    saveError(message);

    return false;
  }

  if (COMMIT_EDITMSG_ERR) {
    fs.unlinkSync(COMMIT_EDITMSG_ERR);
  }

  return true;
}

function validateMany(from) {
  var errorsCount = 0;

  gitRawCommits({ from })
    .setEncoding()
    .on('data', (message) => {
      if (!validate(message)) {
        errorsCount += 1;
      }
    })
    .on('close', () => process.exit(errorsCount));
}

function validateSingle(msgFileOrText) {
  var commit = getCommit(msgFileOrText);
  var errorsCount = 0;

  if (!validate(commit.message, commit.sourceFile)) {
    errorsCount += 1;
  }

  process.exit(errorsCount);
}


if (program.from) {
  validateMany(program.from);
} else if (program.recover) {
  process.exit(recover() ? 0 : 1);
} else {
  validateSingle(commitMsgFileOrText);
}
