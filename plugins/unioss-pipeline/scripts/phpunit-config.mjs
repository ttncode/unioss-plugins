#!/usr/bin/env node
// Device-independent PHPUnit test config for AdminPage — replaces the manual
// 'git stash apply' step. `apply` writes machine-specific values from config.mjs
// into the four testing-config files; `restore` reverts them via git.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveConfig } from './config.mjs';

const FILES = {
  database: 'application/config/testing/database.php',
  subscriber: 'application/tests/StartedSubscriberImpl.php',
  config: 'application/config/testing/config.php',
  phpunit: 'application/tests/phpunit.xml',
};

export function applyDatabasePhp(content, { mysql, user, pass }) {
  return content
    .replace(/('hostname'\s*=>\s*)[^,]+,/, `$1'${mysql}',`)
    .replace(/('username'\s*=>\s*)[^,]+,/, `$1'${user}',`)
    .replace(/('password'\s*=>\s*)[^,]+,/, `$1'${pass}',`);
}

export function applyStartedSubscriber(content, { mysql, user, pass, skipImport }) {
  const body = `exec('mysql --ssl=0 -h${mysql} -P3306 -u${user} -p${pass} < ' . $db_dump_dir, $output, $retval);`;
  const line = '        ' + (skipImport ? '// ' : '') + body;
  // Match the existing exec line whether commented or not.
  return content.replace(/^[ \t]*\/\/[ \t]*exec\(.*\$db_dump_dir.*\);|^[ \t]*exec\(.*\$db_dump_dir.*\);/m, line);
}

export function applyConfigPhp(content) {
  let out = content;
  if (!out.includes('$_SERVER["HTTP_HOST"] = \'localhost:2380/admin\';')) {
    out = out.replace(
      /(\$config\['base_url'\] = \$http_or_https)/,
      "$_SERVER[\"HTTP_HOST\"] = 'localhost:2380/admin';\n$1",
    );
  }
  if (!out.includes("$config['composer_autoload']")) {
    out = out.replace(/\s*$/, '') +
      "\n\n$config['composer_autoload'] = realpath(APPPATH . '../../my-vendor/vendor/autoload.php');\n";
  }
  return out;
}

const PHP_BLOCK = [
  '\t<php>',
  "\t\t<server name='HTTP_HOST' value='127.0.0.1' />",
  "\t\t<server name='CI_ENV' value='testing' />",
  '\t\t<env name="ENVIRONMENT" value="testing" />',
  '\t\t<ini name="memory_limit" value="2048M" />',
  '\t</php>',
].join('\n');

export function applyPhpunitXml(content) {
  return content.replace(/[ \t]*<php>[\s\S]*?<\/php>/, PHP_BLOCK);
}

function adminPageDir(cwd) {
  const c = resolveConfig(cwd);
  return join(c.source.root, c.source.modules['admin-page']);
}

function runApply(cwd, skipImport) {
  const c = resolveConfig(cwd);
  const creds = { mysql: c.docker.mysql, user: c.db.user, pass: c.db.password };
  const dir = adminPageDir(cwd);
  const rw = (rel, fn) => {
    const p = join(dir, rel);
    writeFileSync(p, fn(readFileSync(p, 'utf8')));
  };
  rw(FILES.database, (t) => applyDatabasePhp(t, creds));
  rw(FILES.subscriber, (t) => applyStartedSubscriber(t, { ...creds, skipImport }));
  rw(FILES.config, applyConfigPhp);
  rw(FILES.phpunit, applyPhpunitXml);
}

function runRestore(cwd) {
  const dir = adminPageDir(cwd);
  execSync(`git checkout -- ${Object.values(FILES).join(' ')}`, { cwd: dir, stdio: 'inherit' });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd, flag] = process.argv.slice(2);
  if (cmd === 'apply') { runApply(process.cwd(), flag !== '--import'); process.stdout.write('phpunit-config applied\n'); }
  else if (cmd === 'restore') { runRestore(process.cwd()); process.stdout.write('phpunit-config restored\n'); }
  else { process.stderr.write('Usage: phpunit-config.mjs <apply [--import|--skip-import]|restore>\n'); process.exit(1); }
}
