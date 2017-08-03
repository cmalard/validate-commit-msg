'use strict';

var fs = require('fs');
var path = require('path');
var findParentDir = require('find-parent-dir');

var getGitFolder = require('./getGitFolder');


// On running the validation over a text instead of git files such as COMMIT_EDITMSG and GITGUI_EDITMSG
// is possible to be doing that the from anywhere. Therefore the git directory might not be available.
var COMMIT_EDITMSG;
var COMMIT_EDITMSG_ERR;
var gitDirectory;
var gitDirectoryError;
try {
  gitDirectory = getGitFolder();

  COMMIT_EDITMSG = path.resolve(gitDirectory, 'COMMIT_EDITMSG')
  COMMIT_EDITMSG_ERR = path.resolve(gitDirectory, 'COMMIT_EDITMSG_ERR')
} catch (err) {
  gitDirectoryError = err;
}

module.exports = function recover() {
  if (!gitDirectory) {
    console.error(gitDirectoryError);

    return false;
  }
  console.warn('L33')

  var previousCommitMessage = fs.readFileSync(COMMIT_EDITMSG_ERR).toString();
  var commitMessage = fs.readFileSync(COMMIT_EDITMSG).toString();

  fs.writeFileSync(COMMIT_EDITMSG, previousCommitMessage + commitMessage);
  console.warn('##' + previousCommitMessage + commitMessage + '##')

  return true;
};
