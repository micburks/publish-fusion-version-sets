#!/usr/bin/env node

const path = require('path');
const {writeFileSync} = require('fs');

const packagePath = path.resolve(__dirname, '../package.json');
const meta = require(packagePath);
const basePackage = 'fusion-cli';
const tag = `${basePackage}-v${meta.devDependencies[basePackage]}`;
meta.publishConfig = meta.publishConfig || {};
meta.publishConfig.tag = tag;

writeFileSync(
  packagePath,
  JSON.stringify(meta, null, 2)
);
